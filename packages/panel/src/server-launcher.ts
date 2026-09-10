import { reviewLaunchSchema } from "@distilly/protocol";
import type { ReviewLaunch, ReviewRef } from "@distilly/protocol";
import type { ReviewPresenter } from "@distilly/mcp";

import type { PanelHandle } from "./server-http.js";

const ROOT_URL_PATTERN = /^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})\/#([0-9a-f]{64})$/u;

/** Lazy factory used by PanelLauncher without exposing runtime composition. */
export interface PanelLauncherOptions {
  readonly start: () => Promise<PanelHandle>;
}

type LauncherState = "new" | "starting" | "running" | "closing" | "closed";

const validateRootUrl = (value: string): { readonly origin: string; readonly token: string } => {
  const match = ROOT_URL_PATTERN.exec(value);
  if (match === null)
    throw new Error("Panel handle URL does not match the exact loopback root form.");
  const port = Number(match[1]);
  if (port > 65_535 || port === 80) {
    throw new Error("Panel handle URL contains an invalid or default port.");
  }
  return { origin: `http://127.0.0.1:${port}`, token: match[2] ?? "" };
};

/** Single-flight ReviewPresenter that owns one PanelHandle and no EngineClient. */
export class PanelLauncher implements ReviewPresenter {
  readonly #options: PanelLauncherOptions;
  #state: LauncherState = "new";
  #handle: PanelHandle | undefined;
  #starting: Promise<PanelHandle> | undefined;
  #closing: Promise<void> | undefined;
  #handleClose: Promise<void> | undefined;

  /**
   * Creates a launcher around a lazy Panel server factory.
   *
   * @param options - Factory that starts one owned Panel handle.
   */
  constructor(options: PanelLauncherOptions) {
    this.#options = options;
  }

  #closeHandle(handle: PanelHandle): Promise<void> {
    this.#handle = handle;
    this.#state = "closing";
    this.#handleClose ??= (async () => {
      try {
        await handle.close();
      } finally {
        this.#state = "closed";
      }
    })();
    return this.#handleClose;
  }

  async #start(): Promise<PanelHandle> {
    if (this.#handle !== undefined) return this.#handle;
    if (this.#starting !== undefined) return await this.#starting;
    if (this.#state === "closing" || this.#state === "closed") {
      throw new Error("PanelLauncher is closing or closed.");
    }

    this.#state = "starting";
    let started: Promise<PanelHandle>;
    try {
      started = this.#options.start();
    } catch (error) {
      this.#state = "new";
      throw error;
    }
    const attempt = started.then(async (handle) => {
      try {
        validateRootUrl(handle.url);
      } catch (error) {
        const closeAttempt = this.#closeHandle(handle);
        this.#closing ??= closeAttempt;
        await closeAttempt.catch(() => undefined);
        throw error;
      }
      if (this.#state === "starting") {
        this.#handle = handle;
        this.#state = "running";
      } else if (this.#state === "closing") {
        this.#handle = handle;
      }
      return handle;
    });
    this.#starting = attempt;
    try {
      return await attempt;
    } catch (error) {
      if (this.#state === "starting") this.#state = "new";
      throw error;
    } finally {
      if (this.#starting === attempt) this.#starting = undefined;
    }
  }

  /**
   * Starts the one owned Panel and returns its browser entry URL.
   *
   * The standalone `distilly panel` command uses this to report the URL a human should
   * open; a review presentation keeps using {@link present}, which appends the exact
   * review route to this same root.
   *
   * @returns The validated loopback root URL, including its access token.
   */
  async start(): Promise<string> {
    if (this.#state === "closing" || this.#state === "closed") {
      throw new Error("PanelLauncher is closing or closed.");
    }
    const handle = await this.#start();
    if (this.#state !== "running" || this.#handle !== handle) {
      throw new Error("PanelLauncher closed while the Panel was starting.");
    }
    return handle.url;
  }

  /**
   * Presents exactly one immutable suspended-candidate reference.
   *
   * @param review - Candidate selected by the engine.
   * @returns A launch URL containing exactly the same review reference.
   */
  async present(review: ReviewRef): Promise<ReviewLaunch> {
    if (this.#state === "closing" || this.#state === "closed") {
      throw new Error("PanelLauncher is closing or closed.");
    }
    const handle = await this.#start();
    if (this.#state !== "running" || this.#handle !== handle) {
      throw new Error("PanelLauncher closed while the Panel was starting.");
    }
    const root = validateRootUrl(handle.url);
    return reviewLaunchSchema.parse({
      ref: review,
      url: `${root.origin}/#${root.token}/review/${review.subjectId}/${review.candidateVersionId}`,
    });
  }

  /**
   * Closes the one handle started by this launcher; repeated calls share completion.
   *
   * @returns Shared completion for the single close attempt.
   */
  close(): Promise<void> {
    this.#closing ??= (async () => {
      if (this.#state === "closed") return;
      this.#state = "closing";
      let handle = this.#handle;
      if (handle === undefined && this.#starting !== undefined) {
        try {
          handle = await this.#starting;
        } catch {
          // A failed start has no handle to close.
        }
        handle ??= this.#handle;
      }
      try {
        if (handle !== undefined) await this.#closeHandle(handle);
      } finally {
        this.#state = "closed";
      }
    })();
    return this.#closing;
  }
}
