import type {
  Claim,
  ProfileDiff,
  VersionPage,
  VersionStatus,
  VersionSummary,
} from "@distilly/protocol";

/**
 * Names how one version came to exist.
 *
 * @param version - Version summary from the engine.
 * @returns A short human label.
 */
const creationLabel = (version: VersionSummary): string => {
  if (version.creation.kind === "host_distill") return "distilled by a host";
  if (version.creation.kind === "correction") return "user correction";
  if (version.creation.kind === "rollback") {
    return `rollback to ${version.creation.targetVersionId.slice(0, 14)}…`;
  }
  if (version.creation.kind === "bundle_import") return "imported bundle";
  return "renderer only";
};

/**
 * Renders one stable line for a version, including the id a user must copy to roll back.
 *
 * @param version - Version summary from the engine.
 * @returns One line naming time, id, status, size, and origin.
 */
export const describeVersion = (version: VersionSummary): string =>
  `${version.createdAt}  ${version.id}  ${version.status.padEnd(10)} gen ${String(version.generation)}  ${version.quality.maturity}  ${String(version.quality.activeClaimCount)} active claim(s)  ${creationLabel(version)}`;

/**
 * Renders a paged version history, warning when the current version is not the newest one.
 *
 * @param page - One page of versions in engine order.
 * @param subjectName - Display name, so the report says whose history this is.
 * @returns Stable report lines.
 */
export const describeVersions = (page: VersionPage, subjectName: string): readonly string[] => {
  if (page.items.length === 0) {
    return [
      `${subjectName} has no committed version yet.`,
      "Harvest material and let a host distill it first.",
    ];
  }
  const lines = [`${subjectName}: ${String(page.items.length)} version(s), newest first.`];
  for (const version of page.items) lines.push(`  ${describeVersion(version)}`);
  const current = page.items.find((version) => version.status === "current");
  if (current === undefined) {
    lines.push(
      "",
      "No version is current right now: the versions listed are historical, rejected, or a candidate awaiting review, which happens while a candidate waits for review.",
    );
  }
  if (page.nextCursor !== undefined) {
    lines.push("", `More versions remain; repeat with --cursor ${page.nextCursor}.`);
  }
  return lines;
};

/**
 * Summarizes quality movement between two versions.
 *
 * @param diff - Engine-derived profile diff.
 * @returns Stable report lines.
 */
const facetSummary = (diff: ProfileDiff): readonly string[] => {
  const lines: string[] = [];
  if (diff.changedFacets.length > 0) {
    lines.push(`Changed facets: ${diff.changedFacets.join(", ")}`);
  }
  const before = diff.beforeQuality;
  const after = diff.afterQuality;
  lines.push(
    `Maturity: ${before?.maturity ?? "unknown"} -> ${after.maturity}`,
    `Claims: ${String(before?.activeClaimCount ?? 0)} -> ${String(after.activeClaimCount)} active, ${String(before?.contestedClaimCount ?? 0)} -> ${String(after.contestedClaimCount)} contested`,
    `Covered core facets: ${String(before?.coveredCoreFacets.length ?? 0)} -> ${String(after.coveredCoreFacets.length)}`,
  );
  return lines;
};

/**
 * Renders one claim as a prefixed line.
 *
 * @param prefix - Marker such as "+" or "-".
 * @param claim - Claim to render.
 * @returns One report line.
 */
const claimLine = (prefix: string, claim: Claim): string =>
  `  ${prefix} [${claim.facet}] ${claim.text}`;

/**
 * Renders a semantic diff between two versions, so a bad re-distill is visible before rollback.
 *
 * @param diff - Engine-derived profile diff.
 * @returns Stable report lines.
 */
export const describeProfileDiff = (diff: ProfileDiff): readonly string[] => {
  const lines = [
    `Added ${String(diff.added.length)}, removed ${String(diff.removed.length)}, changed ${String(diff.changed.length)}.`,
    "",
    ...facetSummary(diff),
  ];
  if (diff.added.length > 0) {
    lines.push("", "Added claims:");
    for (const claim of diff.added) lines.push(claimLine("+", claim));
  }
  if (diff.removed.length > 0) {
    lines.push("", "Removed claims:");
    for (const claim of diff.removed) lines.push(claimLine("-", claim));
  }
  if (diff.changed.length > 0) {
    lines.push("", "Changed claims:");
    for (const change of diff.changed) {
      if (change.before.text === change.after.text) {
        // The engine reports a status change (contested, superseded) as a changed claim with the
        // same text, so the difference has to be named or the line reads as a no-op.
        lines.push(
          `  ~ [${change.after.facet}] status ${change.before.status} -> ${change.after.status}, strength ${change.before.strength} -> ${change.after.strength}: ${change.after.text}`,
        );
        continue;
      }
      lines.push(`  ~ [${change.after.facet}] ${change.before.text}`);
      lines.push(`      -> ${change.after.text}`);
    }
  }
  if (diff.added.length + diff.removed.length + diff.changed.length === 0) {
    lines.push("", "The two versions carry the same claims; only metadata differs.");
  }
  return lines;
};

/**
 * Finds the version a user meant by an id or a unique id prefix.
 *
 * A full 64-hex id is unusable to retype, so commands accept a unique prefix and this resolves
 * it against the subject's own history; an ambiguous prefix lists every match instead of
 * picking one.
 *
 * @param versions - Versions of one subject.
 * @param argument - Full version id or a unique prefix.
 * @returns The matching version.
 */
export const resolveVersionArgument = (
  versions: readonly VersionSummary[],
  argument: string,
): VersionSummary => {
  const exact = versions.find((version) => version.id === argument);
  if (exact !== undefined) return exact;
  const matches = versions.filter((version) => version.id.startsWith(argument));
  if (matches.length === 1) {
    const [match] = matches;
    if (match !== undefined) return match;
  }
  if (matches.length === 0) {
    throw new Error(`No version matches "${argument}" for this subject.`);
  }
  throw new Error(
    `"${argument}" matches ${String(matches.length)} versions: ${matches.map((version) => version.id).join(", ")}`,
  );
};

/**
 * Names one version status for a success message.
 *
 * @param status - Engine version status.
 * @returns The status text.
 */
export const statusLabel = (status: VersionStatus): string => status;
