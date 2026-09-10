import type { BriefCapacity } from "@distilly/protocol";

import { contextTooLarge } from "../internal-errors.js";

/**
 * Verifies that a complete profile prompt fits the trusted session budget.
 *
 * The first Preview uses a conservative one UTF-8 byte to one input-token
 * upper bound, matching the complete-briefing capacity rule. No content is
 * truncated, and an SDK session without an advertised capacity keeps the
 * existing direct-read behavior.
 *
 * @param prompt - Complete deterministic profile prompt.
 * @param capacity - Trusted host or SDK capacity, if one was negotiated.
 * @returns The unchanged prompt when it fits the session.
 */
export const enforcePromptCapacity = (
  prompt: string,
  capacity: BriefCapacity | undefined,
): string => {
  if (capacity === undefined) return prompt;
  const serializedBytes = Buffer.byteLength(prompt, "utf8");
  if (
    serializedBytes <= (capacity.maximumInputBytes ?? capacity.maximumInputTokens) &&
    serializedBytes <= capacity.maximumToolResultBytes
  ) {
    return prompt;
  }
  throw contextTooLarge({
    bytes: { serialized: serializedBytes },
    tokens: { estimatedInput: serializedBytes },
    limits: {
      maximumInputTokens: capacity.maximumInputTokens,
      maximumToolResultBytes: capacity.maximumToolResultBytes,
    },
  });
};
