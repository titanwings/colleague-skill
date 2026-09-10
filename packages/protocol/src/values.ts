import type { HostName, LeaseOwnerId, RequestId } from "./ids.js";

/** Trusted identity attached when a client session is created. */
export interface ActorContext {
  readonly kind: "user" | "host" | "sdk" | "executor" | "system";
  readonly id: string;
  readonly host?: HostName;
}

/** Idempotency context required for every mutation method. */
export interface MutationContext {
  readonly requestId: RequestId;
}

/** Capacity negotiated by a trusted host binding or supplied by an SDK client. */
export interface BriefCapacity {
  /** Token budget for model input, derived from a measured byte budget. */
  readonly maximumInputTokens: number;
  /**
   * Byte budget for model input; the quantity a byte comparison must use. Optional for
   * backward compatibility, and a consumer that lacks it falls back to the token budget,
   * which is the stricter reading.
   */
  readonly maximumInputBytes?: number | undefined;
  readonly maximumToolResultBytes: number;
  readonly source: "host_handshake" | "binding_fixture" | "conservative_floor" | "sdk_explicit";
}

/** Trusted session state; it is never accepted inside model tool parameters. */
export interface ClientSessionContext {
  readonly actor: ActorContext;
  readonly leaseOwner: LeaseOwnerId;
  readonly capacity?: BriefCapacity;
}
