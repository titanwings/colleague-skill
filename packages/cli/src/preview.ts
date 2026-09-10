import { createServer } from "node:net";

import { createMcpServer, type McpServer } from "@distilly/mcp";
import { runStdio } from "@distilly/mcp/stdio";
import { PanelLauncher, startPanelServer } from "@distilly/panel/server";
import type { HostBinding, HostContext } from "@distilly/bindings";
import type { BriefCapacity, EngineClient } from "@distilly/protocol";
import { openPreviewLocalRuntime, type PreviewLocalRuntime } from "@distilly/runtime/preview";
import { Distilly } from "distilly";

const DIRECT_USER_CAPACITY = {
  maximumInputTokens: 4_194_304,
  maximumToolResultBytes: 4_194_304,
  source: "sdk_explicit" as const,
};

/** Panel assets plus an optional fixed listener port for tests. */
export interface PreviewPanelOptions {
  readonly assetsDir: string;
  /** Fixed test port; production Preview chooses one at each lazy start attempt. */
  readonly port?: number;
}

/** Trusted host identity and local paths needed by the Preview composition. */
export interface OpenPreviewMcpApplicationOptions {
  readonly root: string;
  readonly binding: HostBinding;
  readonly hostContext: HostContext;
  readonly capacity: BriefCapacity;
  readonly panel: PreviewPanelOptions;
}

/** One owned local Preview graph shared by the facade, MCP, and review Panel. */
export interface PreviewMcpApplication {
  readonly distilly: Distilly;

  /** Serves the exact five MCP tools on this process's stdio transport. */
  runStdio(): Promise<void>;

  /**
   * Starts the loopback review Panel and returns the URL a human opens.
   *
   * A review presentation normally starts the Panel on demand; the standalone panel
   * command needs the root URL without a suspended candidate.
   *
   * @returns The validated loopback root URL, including its access token.
   */
  startPanel(): Promise<string>;

  /** Closes presenters and clients before releasing the single-writer runtime. */
  close(): Promise<void>;
}

const freePanelPort = async (): Promise<number> => {
  const server = createServer();
  await new Promise<void>((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
    throw new Error("Could not select a local Panel port.");
  }
  await new Promise<void>((resolvePromise, reject) =>
    server.close((error) => (error === undefined ? resolvePromise() : reject(error))),
  );
  return address.port;
};

class PreviewMcpApplicationImplementation implements PreviewMcpApplication {
  readonly distilly: Distilly;
  readonly #runtime: PreviewLocalRuntime;
  readonly #hostClient: EngineClient;
  readonly #mcp: McpServer;
  readonly #panel: PanelLauncher;
  #stdioPromise: Promise<void> | undefined;
  #closePromise: Promise<void> | undefined;

  constructor(
    runtime: PreviewLocalRuntime,
    hostClient: EngineClient,
    distilly: Distilly,
    mcp: McpServer,
    panel: PanelLauncher,
  ) {
    this.#runtime = runtime;
    this.#hostClient = hostClient;
    this.distilly = distilly;
    this.#mcp = mcp;
    this.#panel = panel;
  }

  runStdio(): Promise<void> {
    if (this.#closePromise !== undefined) {
      return Promise.reject(new Error("The Developer Preview MCP application is closing."));
    }
    this.#stdioPromise ??= runStdio(this.#mcp);
    return this.#stdioPromise;
  }

  startPanel(): Promise<string> {
    if (this.#closePromise !== undefined) {
      return Promise.reject(new Error("The Developer Preview MCP application is closing."));
    }
    return this.#panel.start();
  }

  close(): Promise<void> {
    this.#closePromise ??= (async () => {
      const mcpClose = this.#mcp.close();
      const transportResults = await Promise.allSettled(
        this.#stdioPromise === undefined ? [mcpClose] : [this.#stdioPromise, mcpClose],
      );
      const panelResults = await Promise.allSettled([this.#panel.close()]);
      const clientResults = await Promise.allSettled([
        this.#hostClient.close(),
        this.distilly.close(),
      ]);
      const runtimeResult = await Promise.allSettled([this.#runtime.close()]);
      const failure = [
        ...transportResults,
        ...panelResults,
        ...clientResults,
        ...runtimeResult,
      ].find((result): result is PromiseRejectedResult => result.status === "rejected");
      if (failure !== undefined) throw failure.reason;
    })();
    return this.#closePromise;
  }
}

/**
 * Opens the real local Preview graph without installing or mutating a host.
 *
 * The caller is a trusted binding. Model input cannot supply actor identity,
 * capacity, storage root, Panel assets, or listener coordinates.
 *
 * @param options - Trusted host session, local root, Panel assets, and optional test port.
 * @returns The owned facade, MCP transport entry, and teardown handle.
 */
export const openPreviewMcpApplication = async (
  options: OpenPreviewMcpApplicationOptions,
): Promise<PreviewMcpApplication> => {
  const runtime = await openPreviewLocalRuntime({
    root: options.root,
    hostBinding: { binding: options.binding, context: options.hostContext },
  });
  try {
    const hostClient = await runtime.connectTrusted({
      actor: {
        kind: "host",
        id: options.hostContext.sessionId,
        host: options.binding.host,
      },
      capacity: options.capacity,
    });
    const userClient = await runtime.connectTrusted({
      actor: { kind: "user", id: options.hostContext.sessionId },
      capacity: DIRECT_USER_CAPACITY,
    });
    const panel = new PanelLauncher({
      start: async () =>
        startPanelServer({
          client: userClient,
          assetsDir: options.panel.assetsDir,
          port: options.panel.port ?? (await freePanelPort()),
        }),
    });
    let schemaProfile: "openclaw" | "hermes" | undefined;
    if (options.binding.host === "openclaw") schemaProfile = "openclaw";
    else if (options.binding.host === "hermes") schemaProfile = "hermes";
    const mcp = createMcpServer({
      client: hostClient,
      reviewPresenter: panel,
      ...(schemaProfile === undefined ? {} : { schemaProfile }),
    });
    return new PreviewMcpApplicationImplementation(
      runtime,
      hostClient,
      new Distilly({ client: userClient }),
      mcp,
      panel,
    );
  } catch (error) {
    await runtime.close().catch(() => undefined);
    throw error;
  }
};
