import { resolve } from "node:path";

import {
  actorContextSchema,
  briefCapacitySchema,
  clientSessionContextSchema,
  DistillyError,
  engineMethodSchemas,
  mutationContextSchema,
} from "@distilly/protocol";
import type {
  ActorContext,
  BriefCapacity,
  ClientSessionContext,
  CoreEngineClient,
  CoreMethodName,
  EngineEvent,
  EngineMethodMap,
  MutationContext,
  MutationMethodName,
  QueryMethodName,
  Unsubscribe,
} from "@distilly/protocol";

import { CryptoIdGenerator } from "./defaults/crypto-id-generator.js";
import { enforcePromptCapacity } from "./distill/prompt-capacity.js";
import type { PreviewHostMutationAuthority } from "./host/mutation-authority.js";
import {
  createInternalEngineComposition,
  type InternalEngineComposition,
} from "./ingest/composition.js";
import type { TrustedFileLoader } from "./ingest/service.js";

export type {
  PreviewHostMutationAuthority,
  PreviewHostMutationMethod,
} from "./host/mutation-authority.js";

type CoreQueryMethodName = Extract<CoreMethodName, QueryMethodName>;
type CoreMutationMethodName = Extract<CoreMethodName, MutationMethodName>;

const ownedRoots = new Set<string>();

const clientClosed = (): DistillyError =>
  new DistillyError({
    code: "busy",
    message: "The Developer Preview Engine client is closed.",
    retryable: false,
  });

const runtimeClosed = (): DistillyError =>
  new DistillyError({
    code: "busy",
    message: "The Developer Preview Engine runtime is closing or closed.",
    retryable: false,
  });

const rootBusy = (): DistillyError =>
  new DistillyError({
    code: "busy",
    message: "Another in-process Developer Preview Engine owns this root.",
    retryable: true,
  });

const previewUnsupported = (method: CoreMethodName): DistillyError =>
  new DistillyError({
    code: "schema_unsupported",
    message: `${method} is not enabled in Distilly 0.1 Developer Preview.`,
    retryable: false,
    remediation: "Use a method enabled by the 0.1 Developer Preview.",
  });

const invalidBoundary = (label: string): DistillyError =>
  new DistillyError({
    code: "invalid_input",
    message: `Invalid Developer Preview ${label}.`,
    retryable: false,
  });

const invalidResult = (method: CoreMethodName): DistillyError =>
  new DistillyError({
    code: "internal_error",
    message: `The Developer Preview Engine produced an invalid ${method} result.`,
    retryable: false,
  });

const normalizeRoot = (value: OpenPreviewEngineOptions): string => {
  const options = value as unknown;
  if (
    typeof options !== "object" ||
    options === null ||
    Array.isArray(options) ||
    Object.keys(options).some((key) => key !== "root" && key !== "fileLoader") ||
    !("root" in options) ||
    typeof options.root !== "string" ||
    options.root.trim().length === 0
  ) {
    throw invalidBoundary("open options");
  }
  return resolve(options.root);
};

const parseParams = <M extends CoreMethodName>(
  method: M,
  value: unknown,
): EngineMethodMap[M]["params"] => {
  try {
    return engineMethodSchemas[method].params.parse(value);
  } catch {
    throw invalidBoundary(`${method} params`);
  }
};

const parseResult = <M extends CoreMethodName>(
  method: M,
  value: unknown,
): EngineMethodMap[M]["result"] => {
  try {
    return engineMethodSchemas[method].result.parse(value);
  } catch {
    throw invalidResult(method);
  }
};

const parseMutation = (value: unknown): MutationContext => {
  try {
    return mutationContextSchema.parse(value);
  } catch {
    throw invalidBoundary("mutation context");
  }
};

const parseSession = (
  options: PreviewEngineSessionOptions,
  leaseOwner: ReturnType<CryptoIdGenerator["leaseOwnerId"]>,
): ClientSessionContext => {
  let actor: ActorContext;
  let capacity: BriefCapacity | undefined;
  try {
    if (
      typeof options !== "object" ||
      options === null ||
      Array.isArray(options) ||
      Object.keys(options).some((key) => key !== "actor" && key !== "capacity")
    ) {
      throw new TypeError("Unexpected trusted session field.");
    }
    actor = actorContextSchema.parse(options.actor) as ActorContext;
    capacity =
      options.capacity === undefined ? undefined : briefCapacitySchema.parse(options.capacity);
    return clientSessionContextSchema.parse({
      actor,
      leaseOwner,
      ...(capacity === undefined ? {} : { capacity }),
    }) as ClientSessionContext;
  } catch {
    throw invalidBoundary("trusted session");
  }
};

const unreachable = (method: never): never => {
  throw new DistillyError({
    code: "internal_error",
    message: `The Developer Preview Engine cannot dispatch ${String(method)}.`,
    retryable: false,
  });
};

/** Trusted identity and optional verified capacity for one Preview client session. */
export interface PreviewEngineSessionOptions {
  readonly actor: ActorContext;
  readonly capacity?: BriefCapacity;
}

/** Filesystem root owned by one in-process Preview Engine runtime. */
export interface OpenPreviewEngineOptions {
  readonly root: string;
  readonly fileLoader?: TrustedFileLoader;
}

/** Explicitly incomplete Developer Preview runtime over the real SQLite core. */
export interface PreviewEngineRuntime {
  /** SQLite authority used by trusted Runtime around host-owned filesystem effects. */
  readonly hostMutations: PreviewHostMutationAuthority;

  /**
   * Creates an isolated trusted client session with an engine-owned lease owner.
   *
   * @param options - Trusted actor and optional verified host capacity.
   * @returns A typed client for the Preview's real core methods.
   */
  connect(options: PreviewEngineSessionOptions): Promise<CoreEngineClient>;

  /**
   * Drains calls, detaches clients, and closes the owned SQLite composition.
   *
   * @returns Completion after the root can be reopened in this process.
   */
  close(): Promise<void>;
}

interface PreviewClientDependencies {
  readonly execute: (
    method: CoreMethodName,
    params: unknown,
    context: MutationContext | undefined,
  ) => Promise<unknown>;
  readonly subscribe: (handler: (event: EngineEvent) => void) => Unsubscribe;
  readonly onClose: (client: PreviewCoreClient) => void;
}

class PreviewCoreClient implements CoreEngineClient {
  readonly #dependencies: PreviewClientDependencies;
  readonly #watches = new Set<Unsubscribe>();
  #closed = false;

  constructor(dependencies: PreviewClientDependencies) {
    this.#dependencies = dependencies;
  }

  /** Calls one supported or explicitly disabled Preview core method. */
  call<M extends CoreQueryMethodName>(
    method: M,
    params: EngineMethodMap[M]["params"],
  ): Promise<EngineMethodMap[M]["result"]>;
  call<M extends CoreMutationMethodName>(
    method: M,
    params: EngineMethodMap[M]["params"],
    context: MutationContext,
  ): Promise<EngineMethodMap[M]["result"]>;
  async call(method: CoreMethodName, params: unknown, context?: MutationContext): Promise<unknown> {
    this.#assertOpen();
    return this.#dependencies.execute(method, params, context);
  }

  /**
   * Subscribes this session to post-commit invalidations.
   *
   * @param handler - Callback removed when this client closes.
   * @returns An idempotent unsubscribe callback.
   */
  watch(handler: (event: EngineEvent) => void): Promise<Unsubscribe> {
    this.#assertOpen();
    let active = true;
    const unsubscribeBus = this.#dependencies.subscribe((event) =>
      this.#closed ? undefined : handler(event),
    );
    const unsubscribe = (): void => {
      if (!active) return;
      active = false;
      unsubscribeBus();
      this.#watches.delete(unsubscribe);
    };
    this.#watches.add(unsubscribe);
    return Promise.resolve(unsubscribe);
  }

  /**
   * Detaches only this client and its watches.
   *
   * @returns Immediate completion without closing storage or releasing leases.
   */
  close(): Promise<void> {
    this.detachFromRuntime();
    return Promise.resolve();
  }

  /** Detaches the client when either the session or its owning runtime closes. */
  detachFromRuntime(): void {
    if (this.#closed) return;
    this.#closed = true;
    for (const unsubscribe of [...this.#watches]) unsubscribe();
    this.#dependencies.onClose(this);
  }

  #assertOpen(): void {
    if (this.#closed) throw clientClosed();
  }
}

class PreviewEngineRuntimeImplementation implements PreviewEngineRuntime {
  readonly hostMutations: PreviewHostMutationAuthority;
  readonly #composition: InternalEngineComposition;
  readonly #ids: CryptoIdGenerator;
  readonly #root: string;
  readonly #clients = new Set<PreviewCoreClient>();
  readonly #inFlight = new Set<Promise<unknown>>();
  #accepting = true;
  #closePromise: Promise<void> | undefined;

  constructor(root: string, composition: InternalEngineComposition, ids: CryptoIdGenerator) {
    this.#root = root;
    this.#composition = composition;
    this.#ids = ids;
    this.hostMutations = composition.hostMutations;
  }

  /**
   * Creates one actor-bound, capacity-bound session with a fresh private lease owner.
   *
   * @param options - Trusted actor and optional verified capacity.
   * @returns The isolated Preview core client.
   */
  connect(options: PreviewEngineSessionOptions): Promise<CoreEngineClient> {
    return Promise.resolve().then(() => {
      this.#assertAccepting();
      const session = parseSession(options, this.#ids.leaseOwnerId());
      const client = new PreviewCoreClient({
        execute: (method, params, context) =>
          this.#run(() => this.#dispatch(method, params, context, session)),
        subscribe: (handler) => {
          this.#assertAccepting();
          return this.#composition.events.subscribe(handler);
        },
        onClose: (closed) => this.#clients.delete(closed),
      });
      this.#clients.add(client);
      return client;
    });
  }

  /**
   * Drains current calls and closes this in-process root owner exactly once.
   *
   * @returns Completion after the root ownership is released.
   */
  close(): Promise<void> {
    if (this.#closePromise !== undefined) return this.#closePromise;
    this.#accepting = false;
    this.#closePromise = (async () => {
      await Promise.allSettled([...this.#inFlight]);
      for (const client of [...this.#clients]) client.detachFromRuntime();
      try {
        this.#composition.close();
      } finally {
        ownedRoots.delete(this.#root);
      }
    })();
    return this.#closePromise;
  }

  #assertAccepting(): void {
    if (!this.#accepting) throw runtimeClosed();
  }

  #run<T>(operation: () => Promise<T>): Promise<T> {
    this.#assertAccepting();
    const pending = Promise.resolve().then(operation);
    this.#inFlight.add(pending);
    void pending.then(
      () => this.#inFlight.delete(pending),
      () => this.#inFlight.delete(pending),
    );
    return pending;
  }

  async #dispatch(
    method: CoreMethodName,
    params: unknown,
    context: MutationContext | undefined,
    session: ClientSessionContext,
  ): Promise<unknown> {
    try {
      return await this.#dispatchMethod(method, params, context, session);
    } catch (error) {
      if (error instanceof DistillyError) throw error;
      throw invalidResult(method);
    }
  }

  async #dispatchMethod(
    method: CoreMethodName,
    params: unknown,
    context: MutationContext | undefined,
    session: ClientSessionContext,
  ): Promise<unknown> {
    switch (method) {
      case "subjects.create": {
        const result = await this.#composition.subjects.create(
          parseParams(method, params),
          session.actor,
          parseMutation(context),
        );
        return parseResult(method, result);
      }
      case "subjects.list":
        return parseResult(
          method,
          await this.#composition.subjects.list(parseParams(method, params)),
        );
      case "subjects.resolve":
        return parseResult(
          method,
          await this.#composition.subjects.resolve(parseParams(method, params)),
        );
      case "subjects.archive":
      case "subjects.purge":
      case "distill.redistill":
      case "library.rebuild":
      case "bundles.import":
      case "bundles.export":
        parseParams(method, params);
        parseMutation(context);
        throw previewUnsupported(method);
      case "materials.ingestFiles": {
        const result = await this.#composition.ingest.ingestFiles(
          parseParams(method, params),
          session.actor,
          parseMutation(context),
        );
        return parseResult(method, result);
      }
      case "materials.ingest": {
        const result = await this.#composition.ingest.ingest(
          parseParams(method, params),
          session.actor,
          parseMutation(context),
        );
        return parseResult(method, result);
      }
      case "materials.list":
        return parseResult(
          method,
          await this.#composition.materials.list(parseParams(method, params)),
        );
      case "materials.get":
        return parseResult(
          method,
          await this.#composition.materials.get(parseParams(method, params)),
        );
      case "distill.pending":
        return parseResult(
          method,
          await this.#composition.leases.pending(parseParams(method, params)),
        );
      case "distill.brief": {
        const result = await this.#composition.leases.brief(
          parseParams(method, params),
          session,
          parseMutation(context),
        );
        return parseResult(method, result);
      }
      case "distill.renew": {
        const result = await this.#composition.leases.renew(
          parseParams(method, params),
          session,
          parseMutation(context),
        );
        return parseResult(method, result);
      }
      case "distill.release": {
        const result = await this.#composition.leases.release(
          parseParams(method, params),
          session,
          parseMutation(context),
        );
        return parseResult(method, result);
      }
      case "distill.commit": {
        const result = await this.#composition.commits.commit(
          parseParams(method, params),
          session,
          parseMutation(context),
        );
        return parseResult(method, result);
      }
      case "profiles.get":
        return parseResult(
          method,
          await this.#composition.profiles.get(parseParams(method, params)),
        );
      case "profiles.prompt":
        return parseResult(
          method,
          enforcePromptCapacity(
            await this.#composition.profiles.prompt(parseParams(method, params)),
            session.capacity,
          ),
        );
      case "profiles.status":
        return parseResult(
          method,
          await this.#composition.profiles.status(parseParams(method, params)),
        );
      case "profiles.correct": {
        const result = await this.#composition.corrections.correct(
          parseParams(method, params),
          session.actor,
          parseMutation(context),
        );
        return parseResult(method, result);
      }
      case "versions.list":
        return parseResult(
          method,
          await this.#composition.versions.list(parseParams(method, params)),
        );
      case "versions.diff":
        return parseResult(
          method,
          await this.#composition.versions.diff(parseParams(method, params)),
        );
      case "versions.promote": {
        const result = await this.#composition.review.promote(
          parseParams(method, params),
          session.actor,
          parseMutation(context),
        );
        return parseResult(method, result);
      }
      case "versions.reject": {
        const result = await this.#composition.review.reject(
          parseParams(method, params),
          session.actor,
          parseMutation(context),
        );
        return parseResult(method, result);
      }
      case "versions.rollback": {
        const result = await this.#composition.review.rollback(
          parseParams(method, params),
          session.actor,
          parseMutation(context),
        );
        return parseResult(method, result);
      }
      case "versions.lineage":
        return parseResult(
          method,
          await this.#composition.versions.lineage(parseParams(method, params)),
        );
      case "library.list":
        return parseResult(
          method,
          await this.#composition.library.list(parseParams(method, params)),
        );
      case "reviews.list":
        return parseResult(
          method,
          await this.#composition.reviews.list(parseParams(method, params)),
        );
      case "bundles.inspect":
        parseParams(method, params);
        throw previewUnsupported(method);
    }
    return unreachable(method);
  }
}

/**
 * Opens the explicit 0.1 Developer Preview Engine over one normalized local root.
 *
 * @param options - Root owned exclusively by this in-process runtime.
 * @returns The opened Preview runtime.
 */
export { canonicalizeMaterialText } from "./ingest/normalize.js";

export const openPreviewEngine = async (
  options: OpenPreviewEngineOptions,
): Promise<PreviewEngineRuntime> => {
  const root = normalizeRoot(options);
  if (ownedRoots.has(root)) throw rootBusy();
  ownedRoots.add(root);
  try {
    const ids = new CryptoIdGenerator();
    const composition = await createInternalEngineComposition({
      root,
      ids,
      ...(options.fileLoader === undefined ? {} : { fileLoader: options.fileLoader }),
    });
    return new PreviewEngineRuntimeImplementation(root, composition, ids);
  } catch (error) {
    ownedRoots.delete(root);
    throw error;
  }
};
