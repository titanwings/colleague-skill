import {
  subjectIdSchema,
  type AmbiguousSubjectCandidates,
  type CoreFacetName,
  type Profile,
  type SubjectPage,
  type SubjectStatus,
  type SubjectSummary,
} from "@distilly/protocol";

/** What material would let a profile cover one core facet that is still empty. */
const FACET_GUIDANCE: Readonly<Record<CoreFacetName, string>> = Object.freeze({
  identity: "something that states who this person is and how they are addressed",
  voice: "a real conversation excerpt, so the phrasing is quoted rather than described",
  psyche: "a decision they made, with the reasoning they gave for it",
  relations: "how they treat someone close, someone new, and someone with authority",
  boundaries: "something they refused, avoided, or said they would never do",
  texture: "ordinary detail: habits, objects, places, and times of day",
  timeline: "dated material that shows how they changed",
});

/** Facet order used whenever a report lists facets. */
const FACET_ORDER: readonly CoreFacetName[] = Object.freeze([
  "identity",
  "voice",
  "psyche",
  "relations",
  "boundaries",
  "texture",
  "timeline",
]);

/** Rendered, human-readable report of one profile and what it still lacks. */
export interface ProfileReport {
  readonly lines: readonly string[];
  readonly missingFacets: readonly CoreFacetName[];
}

/**
 * Renders one profile's maturity, evidence counts, and the material it still needs.
 *
 * The engine already computes every number here; this only decides what a person reads and
 * in which order, so a thin profile says exactly which material would thicken it instead
 * of leaving the reader to guess.
 *
 * @param profile - Current profile projection.
 * @param status - Optional subject status, so the report can say whether distillation is
 * queued or waiting for more material.
 * @returns Stable report lines plus the facets that carry no claim yet.
 */
export const describeProfile = (profile: Profile, status?: SubjectStatus): ProfileReport => {
  const quality = profile.quality;
  const missing = FACET_ORDER.filter((facet) => quality.uncoveredCoreFacets.includes(facet));
  const covered = FACET_ORDER.filter((facet) => quality.coveredCoreFacets.includes(facet));
  const lines = [
    `${profile.displayName} (${profile.subjectId})`,
    `Version: ${profile.versionId}`,
    `Maturity: ${quality.maturity}`,
    `Claims: ${String(quality.activeClaimCount)} active, ${String(quality.contestedClaimCount)} contested, ${String(quality.userAssertedClaimCount)} user-asserted, ${String(quality.corroboratedClaimCount)} corroborated`,
    `Sources: ${String(quality.sourceGroupCount)} group(s), ${String(quality.diversityEligibleSourceGroupCount)} eligible for diversity, ${String(quality.unknownSourceGroupCount)} unknown`,
    `Covered core facets: ${covered.length === 0 ? "none" : covered.join(", ")}`,
    `Missing core facets: ${missing.length === 0 ? "none" : missing.join(", ")}`,
  ];
  if (status !== undefined) {
    lines.push(
      status.pendingJobId === undefined
        ? "Distillation: nothing queued; add material or ask for a redistill."
        : `Distillation: job ${status.pendingJobId} is waiting to be briefed and committed.`,
    );
  }
  if (missing.length > 0) {
    lines.push("", "To cover what is missing, add material like:");
    for (const facet of missing) lines.push(`  ${facet}: ${FACET_GUIDANCE[facet]}`);
  }
  if (quality.contestedClaimCount > 0) {
    lines.push(
      "",
      `${String(quality.contestedClaimCount)} claim(s) are contested; review them before relying on this profile.`,
    );
  }
  if (quality.sourceGroupCount === 1) {
    lines.push("", "Everything comes from a single source group, so nothing is corroborated yet.");
  }
  return { lines, missingFacets: missing };
};

/**
 * Renders the state of a subject that has material but no committed profile yet.
 *
 * A freshly harvested person is the most common state in the one-shot flow, so it must read
 * as "nothing is wrong, the host still has to distill this" rather than as an engine error.
 *
 * @param subject - Resolved subject summary.
 * @param status - Current subject status, including any queued distillation job.
 * @returns Stable report lines.
 */
export const describePendingProfile = (
  subject: SubjectSummary,
  status?: SubjectStatus,
): readonly string[] => {
  const lines = [
    `${subject.displayName} (${subject.id})`,
    "No profile yet: material is stored, but no distillation has been committed.",
  ];
  if (status?.pendingJobId !== undefined) {
    lines.push(
      `Distillation: job ${status.pendingJobId} is waiting for the host to brief and commit it.`,
    );
  } else if (status !== undefined) {
    lines.push("Distillation: nothing queued; add material or ask for a redistill.");
  }
  lines.push(
    "",
    "Open the host that has Distilly installed and ask it to distill this person, or review it in the Panel.",
  );
  return lines;
};

/**
 * Reports whether a command argument is a subject id rather than a name to look up.
 *
 * A person types a name; the engine addresses a SubjectId. Commands accept either, so this
 * is the single place that decides which one the argument is, using the protocol's own id
 * pattern instead of a second guess.
 *
 * @param value - Raw command argument.
 * @returns True when the argument is already a canonical subject id.
 */
export const looksLikeSubjectId = (value: string): boolean =>
  subjectIdSchema.safeParse(value).success;

/**
 * Renders one subject as a single line a person can copy from.
 *
 * @param subject - Subject summary from the engine.
 * @returns One stable line naming the person, the id to reuse, and what already exists.
 */
export const describeSubject = (subject: SubjectSummary): string => {
  const profile = subject.currentVersionId === undefined ? "no profile yet" : "has a profile";
  return `${subject.displayName} (${subject.id}) — ${profile} · ${subject.space.kind} · ${subject.lifecycle}`;
};

/**
 * Renders a subject listing, including what to run when nothing matches.
 *
 * @param page - One page of subjects in canonical order.
 * @param query - Optional text filter the page was requested with.
 * @returns Stable report lines.
 */
export const describeSubjectList = (page: SubjectPage, query?: string): readonly string[] => {
  if (page.items.length === 0) {
    return query === undefined || query.length === 0
      ? [
          "No subjects yet.",
          "Create one from a directory of your own files: distilly harvest <directory> --host <host> --name <display-name>",
        ]
      : [
          `No subject matches "${query}".`,
          "List every subject with: distilly subjects --host <host>",
        ];
  }
  const lines = page.items.map((subject) => describeSubject(subject));
  lines.push(
    "",
    page.nextCursor === undefined
      ? `${String(page.items.length)} subject(s).`
      : `${String(page.items.length)} subject(s); more remain, repeat with --cursor ${page.nextCursor}.`,
  );
  return lines;
};

/**
 * Renders the candidates behind an ambiguous name so the caller can choose one.
 *
 * Resolution refuses to guess between people with the same name, so the report must hand
 * back every candidate id and the exact command that picks one.
 *
 * @param query - Name the caller asked for.
 * @param candidates - Two or more subjects the engine matched.
 * @returns Stable report lines.
 */
export const describeAmbiguousSubject = (
  query: string,
  candidates: AmbiguousSubjectCandidates,
): readonly string[] => [
  `${String(candidates.length)} subjects match "${query}":`,
  ...candidates.map((candidate) => `  ${describeSubject(candidate)}`),
  "",
  `Repeat the command with one of those ids instead of the name.`,
];
