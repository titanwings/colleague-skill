import { lstat, readFile } from "node:fs/promises";
import { basename, extname } from "node:path";

import { createBuiltinParserRegistry } from "@distilly/adapters";

import { splitParsedText } from "./split-parsed-text.js";
import type { ParsedMaterial } from "@distilly/adapters";
import type { HostBinding, HostContext, HostInjector } from "@distilly/bindings";
import {
  openPreviewEngine,
  type PreviewEngineRuntime,
  type PreviewHostMutationAuthority,
} from "@distilly/engine/preview";
import {
  actorContextSchema,
  DistillyError,
  WIRE_LIMITS,
  engineMethodSchemas,
  isoDateTimeSchema,
  mutationContextSchema,
} from "@distilly/protocol";
import type {
  ActorContext,
  BriefCapacity,
  CoreEngineClient,
  CoreMethodName,
  EngineClient,
  EngineEvent,
  EngineMethodMap,
  MutationContext,
  MutationMethodName,
  QueryMethodName,
  RequestId,
  RuntimeOwnedMethodName,
  SubjectId,
  Unsubscribe,
} from "@distilly/protocol";

type DynamicCoreCall = (
  method: CoreMethodName,
  params: unknown,
  context?: MutationContext,
) => Promise<unknown>;

const localClientClosed = (): DistillyError =>
  new DistillyError({
    code: "busy",
    message: "The Developer Preview LocalRuntime client is closed.",
    retryable: false,
  });

const localRuntimeClosed = (): DistillyError =>
  new DistillyError({
    code: "busy",
    message: "The Developer Preview LocalRuntime is closing or closed.",
    retryable: false,
  });

const previewUnsupported = (method: RuntimeOwnedMethodName): DistillyError =>
  new DistillyError({
    code: "schema_unsupported",
    message: `${method} is not enabled in Distilly 0.1 Developer Preview.`,
    retryable: false,
    remediation: "Use a method enabled by the 0.1 Developer Preview.",
    details: { kind: "preview_method_deferred", method },
  });

const hostUnavailable = (): DistillyError =>
  new DistillyError({
    code: "host_unsupported",
    message: "The requested host does not have a verified full Distilly binding.",
    retryable: false,
    remediation: "Run Distilly setup for this host and restart it.",
  });

const invalidHostResult = (): DistillyError =>
  new DistillyError({
    code: "internal_error",
    message: "The verified host binding returned an inconsistent Profile projection.",
    retryable: false,
  });

const invalidBoundary = (label: string): DistillyError =>
  new DistillyError({
    code: "invalid_input",
    message: `Invalid Developer Preview ${label}.`,
    retryable: false,
  });

const mediaTypeForPath = (path: string): string => {
  switch (extname(path).toLowerCase()) {
    case ".txt":
      return "text/plain";
    case ".md":
    case ".markdown":
      return "text/markdown";
    case ".json":
      return "application/json";
    case ".eml":
      return "message/rfc822";
    case ".mbox":
    case ".mbx":
      return "application/mbox";
    case ".srt":
      return "application/x-subrip";
    case ".vtt":
      return "text/vtt";
    default:
      return "application/octet-stream";
  }
};

const parserWarning = (error: unknown): string => {
  if (error instanceof DistillyError && error.code === "context_too_large") {
    return "Parsed text exceeds the local material limit; narrow the file and try again.";
  }
  if (error instanceof DistillyError && error.code === "invalid_input") {
    return "The local file could not be parsed as valid text for its format.";
  }
  return "The local parser could not extract text from this file.";
};

/**
 * Rejects a symlink at the user-selected file path before it is read.
 *
 * @param path - Explicit local file path selected by the user.
 */
const assertNoSymlinkFile = async (path: string): Promise<void> => {
  const metadata = await lstat(path);
  if (metadata.isSymbolicLink()) throw new Error("symlinked local path");
};

/** Largest rendered text the loader accepts before it must split into parts. */
const MAXIMUM_PARSED_TEXT_BYTES = WIRE_LIMITS.materialContentBytes * WIRE_LIMITS.ingestMaterials;

const createLocalFileLoader = () => {
  const registry = createBuiltinParserRegistry();
  return {
    async load(input: {
      readonly paths: readonly string[];
      readonly subjectId: SubjectId;
      readonly requestId: RequestId;
      readonly sensitivity: "private" | "shareable";
    }) {
      const labels = new Set<string>();
      input.paths.forEach((path, index) => {
        const pathLabel = basename(path);
        if (pathLabel.length === 0 || pathLabel === "." || pathLabel === "..") {
          throw invalidBoundary(`materials.ingestFiles paths[${String(index)}]`);
        }
        if (labels.has(pathLabel)) {
          throw new DistillyError({
            code: "invalid_input",
            message: "Selected local files must have unique file names.",
            retryable: false,
            fieldPath: `paths[${String(index)}]`,
          });
        }
        labels.add(pathLabel);
      });
      const perPath = await Promise.all(
        input.paths.map(async (path, index) => {
          const pathLabel = basename(path);
          let bytes: Uint8Array;
          try {
            await assertNoSymlinkFile(path);
            const metadata = await lstat(path);
            if (!metadata.isFile()) throw new Error("not a regular file");
            bytes = Uint8Array.from(await readFile(path));
            const after = await lstat(path);
            if (
              !after.isFile() ||
              after.size !== metadata.size ||
              after.mtimeMs !== metadata.mtimeMs
            ) {
              throw new Error("local file changed while reading");
            }
          } catch {
            throw new DistillyError({
              code: "invalid_input",
              message: "A selected local file could not be read.",
              retryable: false,
              fieldPath: `paths[${String(index)}]`,
            });
          }
          const mediaType = mediaTypeForPath(path);
          const source = {
            title: pathLabel,
            medium:
              mediaType === "application/x-subrip" || mediaType === "text/vtt"
                ? ("video" as const)
                : ("document" as const),
            access: "private" as const,
            capturedAt: isoDateTimeSchema.parse(new Date().toISOString()),
          };
          const parser = registry.select(mediaType);
          if (parser === undefined) {
            return {
              pathLabel,
              mediaType,
              bytes,
              source,
              warnings: ["No deterministic local parser supports this file format."],
            };
          }
          let parsed: ParsedMaterial;
          try {
            parsed = await parser.parse(
              { clientRef: pathLabel, mediaType, bytes, source },
              {
                subjectId: input.subjectId,
                requestId: input.requestId,
                maximumOutputBytes: MAXIMUM_PARSED_TEXT_BYTES,
              },
            );
          } catch (error) {
            return { pathLabel, mediaType, bytes, source, warnings: [parserWarning(error)] };
          }
          if (
            parsed.material !== undefined &&
            new TextEncoder().encode(parsed.material.content).byteLength >
              WIRE_LIMITS.materialContentBytes
          ) {
            let parts: readonly string[];
            try {
              parts = splitParsedText(parsed.material.content, WIRE_LIMITS.materialContentBytes);
            } catch (error) {
              // A whitespace run larger than one material cannot become a legal part. Keep the
              // raw file and warn, so one pathological file cannot fail the whole selection.
              return {
                pathLabel,
                mediaType,
                bytes,
                source,
                warnings: [
                  error instanceof DistillyError
                    ? error.message
                    : "The parsed text could not be split into materials.",
                ],
              };
            }
            if (parts.length === 0) {
              // Canonicalization removed everything (the text was only trailing whitespace), so
              // there is no legal material here; keep the raw bytes and say why.
              return {
                pathLabel,
                mediaType,
                bytes,
                source,
                warnings: [
                  "Parsed text is only whitespace after canonicalization; it was stored as an unparsed file.",
                ],
              };
            }
            if (parts.length > WIRE_LIMITS.ingestMaterials) {
              // More parts than one ingest call can carry: refuse rather than drop any.
              return {
                pathLabel,
                mediaType,
                bytes,
                source,
                warnings: [
                  `The parsed text needs ${String(parts.length)} parts, more than one ingest call carries; narrow the file.`,
                ],
              };
            }
            return parts.map((part, index) => {
              // The label may not contain "/" or "\\": the engine treats it as a label, not a path.
              const partLabel = `${pathLabel} [part ${String(index + 1)} of ${String(parts.length)}]`;
              return {
                pathLabel: partLabel,
                mediaType,
                bytes: new TextEncoder().encode(part),
                source: { ...source, title: partLabel },
                parsed: {
                  ...parsed.material!,
                  clientRef: partLabel,
                  content: part,
                  source: { ...parsed.material!.source, title: partLabel },
                  sensitivity: input.sensitivity,
                },
                warnings: [
                  ...parsed.warnings,
                  `Split into ${String(parts.length)} parts to fit the local material limit.`,
                ],
              };
            });
          }
          return {
            pathLabel,
            mediaType,
            bytes,
            source,
            ...(parsed.material === undefined
              ? {}
              : { parsed: { ...parsed.material, sensitivity: input.sensitivity } }),
            warnings: parsed.warnings,
          };
        }),
      );
      const records = perPath.flat();
      // One selected file can expand into several records when its parsed text is split, so
      // the file count is not the record count. Refuse here, with a reason the caller can act
      // on, instead of letting the engine see more records than the wire limit allows.
      if (records.length > WIRE_LIMITS.ingestMaterials) {
        throw new DistillyError({
          code: "invalid_input",
          message: `This selection expands to ${String(records.length)} material records, more than the ${String(WIRE_LIMITS.ingestMaterials)} one ingest call carries.`,
          retryable: false,
          remediation: "Ingest fewer files at once, starting with the largest ones.",
          details: {
            reason: "record_budget_exceeded",
            records: records.length,
            maximumRecords: WIRE_LIMITS.ingestMaterials,
          },
        });
      }
      return records;
    },
  };
};

const parseRuntimeParams = <M extends RuntimeOwnedMethodName>(
  method: M,
  value: unknown,
): EngineMethodMap[M]["params"] => {
  try {
    return engineMethodSchemas[method].params.parse(value);
  } catch {
    throw invalidBoundary(`${method} params`);
  }
};

const parseRuntimeMutation = (value: unknown): MutationContext => {
  try {
    return mutationContextSchema.parse(value);
  } catch {
    throw invalidBoundary("mutation context");
  }
};

/** Trusted session identity accepted by the local Developer Preview runtime. */
export interface PreviewTrustedSessionOptions {
  readonly actor: ActorContext;
  readonly capacity?: BriefCapacity;
}

/** Root configuration for the local Developer Preview runtime. */
export interface OpenPreviewLocalRuntimeOptions {
  readonly root: string;
  readonly hostBinding?: {
    readonly binding: HostBinding;
    readonly context: HostContext;
  };
}

/** Explicit Developer Preview composition of local Engine core methods. */
export interface PreviewLocalRuntime {
  /**
   * Binds one trusted actor and verified capacity to a full typed client.
   *
   * @param options - Trusted identity and optional capacity from a binding.
   * @returns An EngineClient whose disabled Preview methods fail visibly.
   */
  connectTrusted(options: PreviewTrustedSessionOptions): Promise<EngineClient>;

  /**
   * Drains local calls and closes the owned Engine runtime.
   *
   * @returns Completion after all local resources close.
   */
  close(): Promise<void>;
}

interface PreviewLocalClientDependencies {
  readonly core: CoreEngineClient;
  readonly actor: ActorContext;
  readonly hostMutations: PreviewHostMutationAuthority;
  readonly injector?: HostInjector;
  readonly run: <T>(operation: () => Promise<T>) => Promise<T>;
  readonly runHost: <T>(operation: () => Promise<T>) => Promise<T>;
  readonly onClose: (client: PreviewLocalClient) => void;
}

class PreviewLocalClient implements EngineClient {
  readonly #core: CoreEngineClient;
  readonly #callCore: DynamicCoreCall;
  readonly #actor: ActorContext;
  readonly #hostMutations: PreviewHostMutationAuthority;
  readonly #injector: HostInjector | undefined;
  readonly #run: PreviewLocalClientDependencies["run"];
  readonly #runHost: PreviewLocalClientDependencies["runHost"];
  readonly #onClose: PreviewLocalClientDependencies["onClose"];
  #closed = false;
  #closePromise: Promise<void> | undefined;

  constructor(dependencies: PreviewLocalClientDependencies) {
    this.#core = dependencies.core;
    this.#callCore = this.#core.call.bind(this.#core);
    this.#actor = dependencies.actor;
    this.#hostMutations = dependencies.hostMutations;
    this.#injector = dependencies.injector;
    this.#run = dependencies.run;
    this.#runHost = dependencies.runHost;
    this.#onClose = dependencies.onClose;
  }

  /** Calls one core method or a visibly disabled runtime-owned Preview method. */
  call<M extends QueryMethodName>(
    method: M,
    params: EngineMethodMap[M]["params"],
  ): Promise<EngineMethodMap[M]["result"]>;
  call<M extends MutationMethodName>(
    method: M,
    params: EngineMethodMap[M]["params"],
    context: MutationContext,
  ): Promise<EngineMethodMap[M]["result"]>;
  async call(
    method: keyof EngineMethodMap,
    params: unknown,
    context?: MutationContext,
  ): Promise<unknown> {
    this.#assertOpen();
    return this.#run(async () => {
      if (method === "hosts.install" || method === "hosts.uninstall" || method === "hosts.export") {
        return this.#runHost(() => this.#callHost(method, params, context));
      }
      if (method === "system.doctor") {
        parseRuntimeParams(method, params);
        throw previewUnsupported(method);
      }
      return this.#callCore(method, params, context);
    });
  }

  /**
   * Subscribes through the owned core session.
   *
   * @param handler - Post-commit invalidation callback.
   * @returns The core session's unsubscribe callback.
   */
  async watch(handler: (event: EngineEvent) => void): Promise<Unsubscribe> {
    this.#assertOpen();
    return this.#run(() => this.#core.watch(handler));
  }

  /**
   * Detaches this wrapper and its core session without closing LocalRuntime.
   *
   * @returns Completion after this session's watches detach.
   */
  close(): Promise<void> {
    if (this.#closePromise !== undefined) return this.#closePromise;
    this.#closed = true;
    this.#onClose(this);
    this.#closePromise = this.#core.close();
    return this.#closePromise;
  }

  /**
   * Detaches this wrapper when its owning LocalRuntime closes.
   *
   * @returns Completion after the core client detaches.
   */
  detachFromRuntime(): Promise<void> {
    return this.close();
  }

  #assertOpen(): void {
    if (this.#closed) throw localClientClosed();
  }

  async #callHost(
    method: "hosts.install" | "hosts.uninstall" | "hosts.export",
    rawParams: unknown,
    rawContext: MutationContext | undefined,
  ): Promise<unknown> {
    const context = parseRuntimeMutation(rawContext);
    switch (method) {
      case "hosts.install": {
        const params = parseRuntimeParams("hosts.install", rawParams);
        const replay = await this.#hostMutations.replay(
          "hosts.install",
          params,
          this.#actor,
          context,
        );
        if (replay !== undefined) return replay;
        const injector = this.#injector;
        if (injector === undefined || injector.host !== params.host) throw hostUnavailable();
        const versionId = params.options?.versionId;
        const profile = await this.#core.call("profiles.get", {
          subjectId: params.subjectId,
          ...(versionId === undefined ? {} : { versionId }),
        });
        const result = await injector.install(profile, params.options ?? {});
        if (result.versionId !== profile.versionId) throw invalidHostResult();
        return this.#hostMutations.complete("hosts.install", params, this.#actor, context, result);
      }
      case "hosts.uninstall": {
        const params = parseRuntimeParams("hosts.uninstall", rawParams);
        const replay = await this.#hostMutations.replay(
          "hosts.uninstall",
          params,
          this.#actor,
          context,
        );
        if (replay !== undefined) return replay;
        const injector = this.#injector;
        if (injector === undefined || injector.host !== params.install.host) {
          throw hostUnavailable();
        }
        await injector.uninstall(params.install);
        return this.#hostMutations.complete("hosts.uninstall", params, this.#actor, context, null);
      }
      case "hosts.export": {
        const params = parseRuntimeParams("hosts.export", rawParams);
        const replay = await this.#hostMutations.replay(
          "hosts.export",
          params,
          this.#actor,
          context,
        );
        if (replay !== undefined) return replay;
        const injector = this.#injector;
        if (injector === undefined || injector.host !== params.host) throw hostUnavailable();
        const versionId = params.options.versionId;
        const profile = await this.#core.call("profiles.get", {
          subjectId: params.subjectId,
          ...(versionId === undefined ? {} : { versionId }),
        });
        const result = await injector.exportIdentity(profile, params.options);
        if (result.versionId !== profile.versionId) throw invalidHostResult();
        return this.#hostMutations.complete("hosts.export", params, this.#actor, context, result);
      }
    }
  }
}

class PreviewLocalRuntimeImplementation implements PreviewLocalRuntime {
  readonly #engine: PreviewEngineRuntime;
  readonly #injector: HostInjector | undefined;
  readonly #clients = new Set<PreviewLocalClient>();
  readonly #inFlight = new Set<Promise<unknown>>();
  #hostTail: Promise<void> = Promise.resolve();
  #accepting = true;
  #closePromise: Promise<void> | undefined;

  constructor(engine: PreviewEngineRuntime, injector?: HostInjector) {
    this.#engine = engine;
    this.#injector = injector;
  }

  /**
   * Binds one trusted LocalRuntime client to a fresh Engine session.
   *
   * @param options - Trusted actor and optional verified capacity.
   * @returns The full typed Preview client.
   */
  async connectTrusted(options: PreviewTrustedSessionOptions): Promise<EngineClient> {
    return this.#run(async () => {
      const core = await this.#engine.connect(options);
      const actor = actorContextSchema.parse(options.actor) as ActorContext;
      const client = new PreviewLocalClient({
        core,
        actor,
        hostMutations: this.#engine.hostMutations,
        ...(this.#injector === undefined ? {} : { injector: this.#injector }),
        run: (operation) => this.#run(operation),
        runHost: (operation) => this.#runHost(operation),
        onClose: (closed) => this.#clients.delete(closed),
      });
      this.#clients.add(client);
      return client;
    });
  }

  /**
   * Drains local calls, detaches wrappers, and closes the Engine once.
   *
   * @returns Completion after all local resources close.
   */
  close(): Promise<void> {
    if (this.#closePromise !== undefined) return this.#closePromise;
    this.#accepting = false;
    this.#closePromise = (async () => {
      await Promise.allSettled([...this.#inFlight]);
      await Promise.all([...this.#clients].map((client) => client.detachFromRuntime()));
      await this.#engine.close();
    })();
    return this.#closePromise;
  }

  #run<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.#accepting) throw localRuntimeClosed();
    const pending = Promise.resolve().then(operation);
    this.#inFlight.add(pending);
    void pending.then(
      () => this.#inFlight.delete(pending),
      () => this.#inFlight.delete(pending),
    );
    return pending;
  }

  #runHost<T>(operation: () => Promise<T>): Promise<T> {
    const pending = this.#hostTail.then(operation, operation);
    this.#hostTail = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  }
}

/**
 * Opens the local 0.1 Developer Preview runtime over one Distilly root.
 *
 * @param options - Local root owned by the composed Engine runtime.
 * @returns The opened LocalRuntime.
 */
export const openPreviewLocalRuntime = async (
  options: OpenPreviewLocalRuntimeOptions,
): Promise<PreviewLocalRuntime> => {
  let injector: HostInjector | undefined;
  if (options.hostBinding !== undefined) {
    const { binding, context } = options.hostBinding;
    if (binding.kind !== "full") throw invalidBoundary("full host binding");
    injector = binding.createInjector(context);
    if (injector.host !== binding.host) throw invalidBoundary("host injector");
  }
  const engine = await openPreviewEngine({
    root: options.root,
    fileLoader: createLocalFileLoader(),
  });
  return new PreviewLocalRuntimeImplementation(engine, injector);
};
