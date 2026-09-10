import { DistillyError, type SubjectSummary } from "@distilly/protocol";

/** The two candidates (or more) an ambiguous subject name produced. */
export type SubjectCandidates = readonly [SubjectSummary, SubjectSummary, ...SubjectSummary[]];

/**
 * Reads the subject the engine matched when a create request collides with an existing name.
 *
 * The engine refuses to merge people silently, so it answers a duplicate create with the one
 * subject it matched. Reusing it is what makes "harvest this folder for Ada" repeatable
 * instead of a hard failure on the second run.
 *
 * @param error - Error thrown by an ingest call.
 * @returns The matched subject, or undefined when this is a different failure.
 */
export const reusableSubject = (error: unknown): SubjectSummary | undefined => {
  if (!(error instanceof DistillyError)) return undefined;
  if (error.code !== "already_exists") return undefined;
  const resolution = error.subjectResolution;
  return resolution?.kind === "found" ? resolution.subject : undefined;
};

/**
 * Reads the candidates behind an ambiguous subject name.
 *
 * @param error - Error thrown by an ingest call.
 * @returns The candidate list, or undefined when this is a different failure.
 */
export const ambiguousCandidates = (error: unknown): SubjectCandidates | undefined => {
  if (!(error instanceof DistillyError)) return undefined;
  if (error.code !== "ambiguous_subject") return undefined;
  const resolution = error.subjectResolution;
  return resolution?.kind === "ambiguous" ? resolution.candidates : undefined;
};
