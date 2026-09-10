import type {
  Claim,
  FacetPath,
  ProfileDiff,
  QualitySummary,
  VersionSummary,
} from "@distilly/protocol";
import { describe, expect, it } from "vitest";

import {
  describeProfileDiff,
  describeVersion,
  describeVersions,
  resolveVersionArgument,
} from "./versions.js";

const quality = (activeClaimCount: number): QualitySummary =>
  ({
    sourceGroupingVersion: "source-groups-v1",
    activeClaimCount,
    contestedClaimCount: 0,
    userAssertedClaimCount: 0,
    corroboratedClaimCount: 0,
    sourceGroupCount: 1,
    diversityEligibleSourceGroupCount: 1,
    unknownSourceGroupCount: 0,
    coveredCoreFacets: ["identity"],
    uncoveredCoreFacets: ["voice"],
    maturity: "sparse",
  }) as unknown as QualitySummary;

const version = (
  id: string,
  status: VersionSummary["status"],
  generation: number,
  createdAt: string,
  activeClaimCount = 1,
): VersionSummary =>
  ({
    id: `version_${id.repeat(64)}`,
    subjectId: `subject_${"a".repeat(32)}`,
    generation,
    materialSetHash: `set_sha256_${"b".repeat(64)}`,
    creation: {
      kind: "host_distill",
      briefContractDigest: `bcd_${"c".repeat(64)}`,
      promptVersion: "v1",
      draftSchemaVersion: 1,
    },
    status,
    actor: { kind: "sdk", id: "test" },
    quality: quality(activeClaimCount),
    createdAt,
  }) as unknown as VersionSummary;

const claim = (text: string, facet = "identity"): Claim =>
  ({
    id: `claim_${"d".repeat(64)}`,
    facet: facet as FacetPath,
    text,
    evidence: [],
    status: "active",
    strength: "single_source",
    observedIn: [],
    createdIn: `version_${"e".repeat(64)}`,
  }) as unknown as Claim;

describe("version history rendering", () => {
  it("prints one copyable line per version and names the current one", () => {
    const current = version("a", "current", 2, "2026-09-10T22:40:04.437Z", 2);
    const historical = version("b", "historical", 1, "2026-09-10T22:40:02.966Z");
    const lines = describeVersions({ items: [current, historical] }, "Ada");
    expect(lines[0]).toBe("Ada: 2 version(s), newest first.");
    expect(lines[1]).toContain(current.id);
    expect(lines[1]).toContain("current");
    expect(lines[1]).toContain("2 active claim(s)");
    expect(lines[2]).toContain("historical");
    expect(lines.join("\n")).not.toContain("No version is current right now");
  });

  it("says when nothing is current because a candidate waits for review", () => {
    const suspended = version("a", "suspended", 2, "2026-09-10T22:40:05.751Z");
    const historical = version("b", "historical", 1, "2026-09-10T22:40:04.437Z");
    const lines = describeVersions({ items: [suspended, historical] }, "Ada");
    expect(lines.join("\n")).toContain("No version is current right now");
  });

  it("says a subject has no version yet instead of printing an empty table", () => {
    const lines = describeVersions({ items: [] }, "Ada");
    expect(lines.join("\n")).toContain("Ada has no committed version yet.");
  });

  it("reports paging and how to continue", () => {
    const page = {
      items: [version("a", "current", 1, "2026-09-10T22:40:02.966Z")],
      nextCursor: "cursor-2",
    };
    expect(describeVersions(page, "Ada").join("\n")).toContain("--cursor cursor-2");
  });

  it("labels how each version was created", () => {
    const rolled = {
      ...version("a", "current", 1, "2026-09-10T22:40:02.966Z"),
      creation: { kind: "rollback", targetVersionId: `version_${"f".repeat(64)}` },
    } as unknown as VersionSummary;
    const line = describeVersion(rolled);
    expect(line).toContain("rollback to version_ffffff…");
  });
});

describe("profile diff rendering", () => {
  const diff = (overrides: Partial<ProfileDiff> = {}): ProfileDiff =>
    ({
      added: [claim("Also asks what breaks second before shipping.")],
      removed: [],
      changed: [],
      changedFacets: ["identity"],
      beforeQuality: quality(1),
      afterQuality: quality(2),
      ...overrides,
    }) as ProfileDiff;

  it("shows counts, facet, quality movement, and each added claim", () => {
    const text = describeProfileDiff(diff()).join("\n");
    expect(text).toContain("Added 1, removed 0, changed 0.");
    expect(text).toContain("Changed facets: identity");
    expect(text).toContain("Claims: 1 -> 2 active");
    expect(text).toContain("+ [identity] Also asks what breaks second before shipping.");
  });

  it("shows removed and changed claims with both texts", () => {
    const text = describeProfileDiff(
      diff({
        added: [],
        removed: [claim("Old boundary rule.")],
        changed: [
          { before: claim("Speaks in long paragraphs."), after: claim("Speaks in short lists.") },
        ],
      }),
    ).join("\n");
    expect(text).toContain("- [identity] Old boundary rule.");
    expect(text).toContain("~ [identity] Speaks in long paragraphs.");
    expect(text).toContain("-> Speaks in short lists.");
  });

  it("says when only metadata differs", () => {
    const text = describeProfileDiff(diff({ added: [], removed: [], changed: [] })).join("\n");
    expect(text).toContain("The two versions carry the same claims");
  });
});

describe("version argument resolution", () => {
  const versions = [
    version("a", "current", 2, "2026-09-10T22:40:04.437Z"),
    version("b", "historical", 1, "2026-09-10T22:40:02.966Z"),
  ];

  it("accepts a full id and a unique prefix", () => {
    expect(resolveVersionArgument(versions, versions[0]!.id).id).toBe(versions[0]!.id);
    expect(resolveVersionArgument(versions, "version_aaaa").id).toBe(versions[0]!.id);
  });

  it("refuses an unknown or ambiguous prefix instead of picking one", () => {
    expect(() => resolveVersionArgument(versions, "version_zzz")).toThrow(
      'No version matches "version_zzz" for this subject.',
    );
    expect(() => resolveVersionArgument(versions, "version_")).toThrow("matches 2 versions");
  });
});
