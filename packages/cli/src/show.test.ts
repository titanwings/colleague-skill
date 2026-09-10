import type { JobId, Profile, SubjectId, SubjectSummary, VersionId } from "@distilly/protocol";
import { describe, expect, it } from "vitest";

import {
  describeAmbiguousSubject,
  describePendingProfile,
  describeProfile,
  describeSubjectList,
  looksLikeSubjectId,
} from "./show.js";

const profile = (overrides: Partial<Profile["quality"]> = {}, claims = 0): Profile =>
  ({
    subjectId: `subject_${"a".repeat(32)}` as SubjectId,
    displayName: "Ada Lovelace",
    versionId: `version_${"b".repeat(64)}` as VersionId,
    claims: Array.from({ length: claims }, () => ({}) as never),
    core: {} as Profile["core"],
    domains: {},
    rendered: "",
    quality: {
      sourceGroupingVersion: "source-groups-v1",
      activeClaimCount: 3,
      contestedClaimCount: 0,
      userAssertedClaimCount: 0,
      corroboratedClaimCount: 0,
      sourceGroupCount: 2,
      diversityEligibleSourceGroupCount: 2,
      unknownSourceGroupCount: 0,
      coveredCoreFacets: ["identity", "voice"],
      uncoveredCoreFacets: ["psyche", "relations", "boundaries", "texture", "timeline"],
      maturity: "forming",
      ...overrides,
    },
  }) as unknown as Profile;

describe("profile report", () => {
  it("names the missing facets and what material would cover each one", () => {
    const report = describeProfile(profile());
    const text = report.lines.join("\n");
    expect(report.missingFacets).toEqual([
      "psyche",
      "relations",
      "boundaries",
      "texture",
      "timeline",
    ]);
    expect(text).toContain("Maturity: forming");
    expect(text).toContain("Covered core facets: identity, voice");
    expect(text).toContain("Missing core facets: psyche, relations, boundaries, texture, timeline");
    expect(text).toContain("psyche: a decision they made");
    expect(text).toContain("boundaries: something they refused");
  });

  it("says nothing is missing once every core facet is covered", () => {
    const report = describeProfile(
      profile({
        coveredCoreFacets: [
          "identity",
          "voice",
          "psyche",
          "relations",
          "boundaries",
          "texture",
          "timeline",
        ],
        uncoveredCoreFacets: [],
        maturity: "stable",
      }),
    );
    expect(report.missingFacets).toEqual([]);
    expect(report.lines.join("\n")).toContain("Missing core facets: none");
    expect(report.lines.join("\n")).not.toContain("To cover what is missing");
  });

  it("warns about contested claims and a single source group", () => {
    const text = describeProfile(
      profile({ contestedClaimCount: 2, sourceGroupCount: 1 }),
    ).lines.join("\n");
    expect(text).toContain("2 claim(s) are contested");
    expect(text).toContain("single source group");
  });
});

const summary = (name: string, letter: string, withProfile: boolean): SubjectSummary => ({
  id: `subject_${letter.repeat(32)}` as SubjectId,
  displayName: name,
  aliases: [],
  identityHints: [],
  space: {
    id: `space_${letter.repeat(32)}` as SubjectSummary["space"]["id"],
    displayName: "People",
    kind: "people",
  },
  lifecycle: "active",
  ...(withProfile ? { currentVersionId: `version_${letter.repeat(64)}` as VersionId } : {}),
});

describe("subject argument and listing", () => {
  it("treats a canonical id as an id and a name as a name", () => {
    expect(looksLikeSubjectId(`subject_${"a".repeat(32)}`)).toBe(true);
    expect(looksLikeSubjectId("Ada Lovelace")).toBe(false);
    expect(looksLikeSubjectId(`subject_${"A".repeat(32)}`)).toBe(false);
    expect(looksLikeSubjectId("subject_short")).toBe(false);
  });

  it("lists subjects with the id to reuse and whether a profile exists", () => {
    const lines = describeSubjectList({
      items: [summary("Ada Lovelace", "a", true), summary("Grace Hopper", "b", false)],
    });
    expect(lines[0]).toBe(
      `Ada Lovelace (subject_${"a".repeat(32)}) — has a profile · people · active`,
    );
    expect(lines[1]).toContain("no profile yet");
    expect(lines.join("\n")).toContain("2 subject(s).");
  });

  it("says how to create the first subject instead of printing an empty table", () => {
    const lines = describeSubjectList({ items: [] });
    expect(lines.join("\n")).toContain("No subjects yet.");
    expect(lines.join("\n")).toContain("distilly harvest <directory> --host <host> --name");
  });

  it("reports a harvested person with no committed profile as a normal state", () => {
    const lines = describePendingProfile(summary("Ada Lovelace", "a", false), {
      subject: summary("Ada Lovelace", "a", false),
      generation: 1,
      pendingJobId: `job_${"c".repeat(32)}` as JobId,
    });
    const text = lines.join("\n");
    expect(text).toContain("No profile yet");
    expect(text).toContain("waiting for the host to brief and commit it");
    expect(text).toContain("Panel");
  });

  it("hands back every candidate when a name is ambiguous", () => {
    const lines = describeAmbiguousSubject("Ada Lovelace", [
      summary("Ada Lovelace", "a", true),
      summary("Ada Lovelace", "b", false),
    ]);
    expect(lines[0]).toBe(`2 subjects match "Ada Lovelace":`);
    expect(lines[1]).toContain(`subject_${"a".repeat(32)}`);
    expect(lines[2]).toContain(`subject_${"b".repeat(32)}`);
    expect(lines.join("\n")).toContain("one of those ids instead of the name");
  });
});
