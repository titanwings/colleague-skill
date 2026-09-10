import { DistillyError, type SubjectSummary } from "@distilly/protocol";
import { describe, expect, it } from "vitest";

import { ambiguousCandidates, reusableSubject } from "./subject-errors.js";

const summary = (letter: string): SubjectSummary => ({
  id: `subject_${letter.repeat(32)}` as SubjectSummary["id"],
  displayName: "Ada Lovelace",
  aliases: [],
  identityHints: [],
  space: {
    id: `space_${letter.repeat(32)}` as SubjectSummary["space"]["id"],
    displayName: "People",
    kind: "people",
  },
  lifecycle: "active",
});

describe("subject errors", () => {
  it("reuses the single subject a duplicate create reported", () => {
    const subject = summary("a");
    const error = new DistillyError({
      code: "already_exists",
      message: "A matching subject already exists.",
      retryable: false,
      subjectResolution: { kind: "found", subject },
    });
    expect(reusableSubject(error)?.id).toBe(subject.id);
    expect(ambiguousCandidates(error)).toBeUndefined();
  });

  it("hands back every candidate behind an ambiguous name", () => {
    const candidates = [summary("a"), summary("b")] as const;
    const error = new DistillyError({
      code: "ambiguous_subject",
      message: "More than one subject matches.",
      retryable: false,
      subjectResolution: { kind: "ambiguous", candidates },
    });
    expect(ambiguousCandidates(error)?.map((candidate) => candidate.id)).toEqual([
      candidates[0].id,
      candidates[1].id,
    ]);
    expect(reusableSubject(error)).toBeUndefined();
  });

  it("ignores unrelated failures and plain errors", () => {
    const missing = new DistillyError({
      code: "not_found",
      message: "No such job.",
      retryable: false,
    });
    expect(reusableSubject(missing)).toBeUndefined();
    expect(ambiguousCandidates(missing)).toBeUndefined();
    expect(reusableSubject(new Error("A matching subject already exists."))).toBeUndefined();
    expect(ambiguousCandidates(undefined)).toBeUndefined();
  });
});
