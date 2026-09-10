import type {
  BriefInput,
  CommitInput,
  CommitResult,
  CreateSubjectInput,
  EngineClient,
  HostDistillBriefing,
  IngestFilesInput,
  IngestFilesResult,
  JobLease,
  PendingFilter,
  PendingJob,
  PurgeResult,
  PurgeSubjectInput,
  RequestId,
  ResolveSubjectInput,
  ResolveSubjectResult,
  ReviewActionInput,
  ReviewPage,
  ReviewQuery,
  SubjectId,
  SubjectPage,
  SubjectQuery,
  VersionSummary,
  ReleaseLeaseInput,
  RenewLeaseInput,
} from "@distilly/protocol";

import { Person } from "./person.js";
import { mutationContext } from "./request-id.js";

/** A pre-connected typed engine client owned outside the browser-safe facade. */
export interface DistillyOptions {
  readonly client: EngineClient;
}

/** Optional identity for replaying the same top-level mutation. */
export interface MutationOptions {
  readonly requestId?: RequestId;
}

/** Browser-safe ergonomic facade over one injected EngineClient session. */
export class Distilly {
  readonly #client: EngineClient;

  /**
   * Creates a facade without opening local files or constructing a runtime.
   *
   * @param options - A pre-connected engine client.
   */
  constructor(options: DistillyOptions) {
    this.#client = options.client;
  }

  /**
   * Creates a synchronous handle for one known subject id.
   *
   * @param subjectId - Stable subject identity.
   * @returns A handle that delegates through this facade's client.
   */
  person(subjectId: SubjectId): Person {
    return new Person(this.#client, subjectId);
  }

  /**
   * Creates a subject through the typed engine method.
   *
   * @param input - Canonical subject fields.
   * @param mutation - Optional request identity for replay.
   * @returns A handle for the created subject.
   */
  async create(input: CreateSubjectInput, mutation?: MutationOptions): Promise<Person> {
    const subject = await this.#client.call(
      "subjects.create",
      input,
      mutationContext(mutation?.requestId),
    );
    return this.person(subject.id);
  }

  /**
   * Ingests explicitly selected local files as material for one subject.
   *
   * The caller owns file selection; this method only forwards the exact paths, so a
   * direct-user surface such as the harvest command can batch a large selection without
   * widening any model-facing tool.
   *
   * @param input - Subject target, explicit local paths, enqueue policy, and sensitivity.
   * @param mutation - Optional request identity for replay.
   * @returns Per-file ingest results plus the resulting generation and pending job.
   */
  async ingestFiles(
    input: IngestFilesInput,
    mutation?: MutationOptions,
  ): Promise<IngestFilesResult> {
    return await this.#client.call(
      "materials.ingestFiles",
      input,
      mutationContext(mutation?.requestId),
    );
  }

  /**
   * Lists subjects visible to the connected client.
   *
   * @param query - Optional subject filters and cursor.
   * @returns A page of subject summaries.
   */
  async list(query: SubjectQuery = {}): Promise<SubjectPage> {
    return this.#client.call("subjects.list", query);
  }

  /**
   * Resolves a subject selector without creating anything.
   *
   * @param input - Id or query selector.
   * @returns Found, absent, or ambiguous resolution.
   */
  async resolve(input: ResolveSubjectInput): Promise<ResolveSubjectResult> {
    return this.#client.call("subjects.resolve", input);
  }

  /**
   * Lists pending distillation work.
   *
   * @param filter - Optional subject and state filters.
   * @returns Pending jobs in engine order.
   */
  async pending(filter: PendingFilter = {}): Promise<readonly PendingJob[]> {
    return this.#client.call("distill.pending", filter);
  }

  /**
   * Acquires a complete host-distillation briefing.
   *
   * @param input - Pending job selector.
   * @param mutation - Optional request identity for replay.
   * @returns The leased briefing.
   */
  async brief(input: BriefInput, mutation?: MutationOptions): Promise<HostDistillBriefing> {
    return this.#client.call("distill.brief", input, mutationContext(mutation?.requestId));
  }

  /**
   * Renews a lease owned by this client session.
   *
   * @param input - Job and lease selector.
   * @param mutation - Optional request identity for replay.
   * @returns The renewed lease.
   */
  async renew(input: RenewLeaseInput, mutation?: MutationOptions): Promise<JobLease> {
    return this.#client.call("distill.renew", input, mutationContext(mutation?.requestId));
  }

  /**
   * Releases a lease owned by this client session.
   *
   * @param input - Job, lease, and optional reason.
   * @param mutation - Optional request identity for replay.
   * @returns Completion after the engine returns its null wire result.
   */
  async release(input: ReleaseLeaseInput, mutation?: MutationOptions): Promise<void> {
    await this.#client.call("distill.release", input, mutationContext(mutation?.requestId));
  }

  /**
   * Commits one evidence-bound claim patch.
   *
   * @param input - Lease-pinned commit input.
   * @param mutation - Optional request identity for replay.
   * @returns Current or suspended commit result.
   */
  async commit(input: CommitInput, mutation?: MutationOptions): Promise<CommitResult> {
    return this.#client.call("distill.commit", input, mutationContext(mutation?.requestId));
  }

  /**
   * Lists suspended review items.
   *
   * @param query - Optional subject and cursor filters.
   * @returns A page of review items in engine order.
   */
  async reviews(query: ReviewQuery = {}): Promise<ReviewPage> {
    return this.#client.call("reviews.list", query);
  }

  /**
   * Promotes the active suspended candidate for a subject.
   *
   * @param input - Candidate and optional reason.
   * @param mutation - Optional request identity for replay.
   * @returns The promoted version summary.
   */
  async promote(input: ReviewActionInput, mutation?: MutationOptions): Promise<VersionSummary> {
    return this.#client.call("versions.promote", input, mutationContext(mutation?.requestId));
  }

  /**
   * Rejects the active suspended candidate for a subject.
   *
   * @param input - Candidate and optional reason.
   * @param mutation - Optional request identity for replay.
   * @returns The rejected version summary.
   */
  async reject(input: ReviewActionInput, mutation?: MutationOptions): Promise<VersionSummary> {
    return this.#client.call("versions.reject", input, mutationContext(mutation?.requestId));
  }

  /**
   * Permanently removes one subject through the explicit destructive method.
   *
   * @param input - Subject identity and confirmation required by the engine.
   * @param mutation - Optional request identity for replay.
   * @returns Stable logical and physical deletion status.
   */
  async purge(input: PurgeSubjectInput, mutation?: MutationOptions): Promise<PurgeResult> {
    return this.#client.call("subjects.purge", input, mutationContext(mutation?.requestId));
  }

  /**
   * Detaches only this injected client session.
   *
   * @returns Completion after EngineClient.close.
   */
  async close(): Promise<void> {
    return this.#client.close();
  }
}
