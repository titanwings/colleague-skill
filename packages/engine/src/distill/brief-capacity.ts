import type { BriefCapacity, HostDistillBriefing } from "@distilly/protocol";

import { canonicalJsonBytes } from "../facts/canonical-json.js";
import { briefingCapacityUnavailable, briefingTooLarge } from "../internal-errors.js";

/** Frozen maximum canonical DistillPatch bytes advertised by v1 briefings. */
export const MAXIMUM_OUTPUT_BYTES = 65_536;

/** Frozen internal ceiling for a complete serialized v1 briefing. */
const MAXIMUM_BRIEFING_BYTES = 4_194_304;

/** Frozen maximum number of short material refs in one complete briefing. */
export const MAXIMUM_BRIEF_MATERIALS = 999;

type BriefingCandidate = Omit<HostDistillBriefing, "limits">;

const withLimits = (
  candidate: BriefingCandidate,
  capacity: BriefCapacity,
  estimatedInputTokens: number,
): HostDistillBriefing => ({
  ...candidate,
  limits: {
    estimatedInputTokens,
    maximumInputTokens: capacity.maximumInputTokens,
    maximumOutputBytes: MAXIMUM_OUTPUT_BYTES,
  },
});

const fixedPointBriefing = (
  candidate: BriefingCandidate,
  capacity: BriefCapacity,
): { readonly briefing: HostDistillBriefing; readonly serializedBytes: number } => {
  let estimate = 0;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const briefing = withLimits(candidate, capacity, estimate);
    const serializedBytes = canonicalJsonBytes(briefing).byteLength;
    if (serializedBytes === estimate) return { briefing, serializedBytes };
    estimate = serializedBytes;
  }
  throw new Error("The briefing byte-count fixed point did not converge.");
};

/**
 * Adds deterministic capacity metadata and rejects any incomplete result before leasing.
 *
 * @param candidate - Complete in-memory briefing including its candidate lease.
 * @param capacity - Trusted session budget, never model-supplied params.
 * @returns The complete briefing whose token upper bound equals its serialized UTF-8 bytes.
 */
export const enforceBriefCapacity = (
  candidate: BriefingCandidate,
  capacity: BriefCapacity | undefined,
): HostDistillBriefing => {
  if (capacity === undefined) throw briefingCapacityUnavailable();

  const { briefing, serializedBytes } = fixedPointBriefing(candidate, capacity);
  const baselineClaims = candidate.baseline?.claims.length ?? 0;
  const evidenceFacts = candidate.baseline?.evidenceFacts.length ?? 0;
  const details = {
    counts: {
      materials: candidate.materials.length,
      baselineClaims,
      evidenceFacts,
      refs: candidate.materials.length,
    },
    bytes: { serialized: serializedBytes },
    tokens: { estimatedInput: briefing.limits.estimatedInputTokens },
    limits: {
      maximumBriefingBytes: MAXIMUM_BRIEFING_BYTES,
      maximumToolResultBytes: capacity.maximumToolResultBytes,
      maximumInputTokens: capacity.maximumInputTokens,
      maximumMaterialRefs: MAXIMUM_BRIEF_MATERIALS,
      maximumOutputBytes: MAXIMUM_OUTPUT_BYTES,
    },
    remediation:
      "Use a larger-capacity host or reduce the new research batch; Distilly will not truncate it.",
  } as const;
  if (
    candidate.materials.length > MAXIMUM_BRIEF_MATERIALS ||
    serializedBytes > MAXIMUM_BRIEFING_BYTES ||
    serializedBytes > capacity.maximumToolResultBytes ||
    // The briefing's `estimatedInputTokens` is a serialized-size fixed point that the lease
    // verifies against the stored bytes, not a token estimate, so the gate compares its
    // size with the byte budget. Comparing it with the token budget rejected briefings the
    // host was verified to carry.
    serializedBytes > (capacity.maximumInputBytes ?? capacity.maximumInputTokens)
  ) {
    throw briefingTooLarge(details);
  }
  return briefing;
};
