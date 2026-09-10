import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { distillyMcpTools } from "@distilly/protocol";

export const PROMPT_MARKERS = Object.freeze([
  "5d630b9597e64edb96f9153ecfd26e39",
  "05831e2bc30a49e8969e17d9221a641e",
  "6a23a1e38829403aa905e1bdac1cbaca",
  "c12edc9478c24a7aa3688e35c6166544",
  "66bc7da0e9264e598f1b45d43ed991cc",
]);
export const BRIEF_MARKERS = Object.freeze([
  "f79bd02c62aa452daed7682bcff4f4cd",
  "f353b67d6a914b11b1703a4948264b2a",
  "e07f72b3e35741dca047a4df2c564913",
  "ff34f54a40d345279028a196b3f73c1a",
  "68e8e865a60f42538d09c5eeb8168648",
]);

const HEX_32 = "a".repeat(32);
const HEX_64 = "b".repeat(64);
export const SUBJECT_ID = `subject_${HEX_32}`;
const JOB_ID = `job_${HEX_32}`;

const subject = {
  id: SUBJECT_ID,
  displayName: "Capacity Boundary Fixture",
  aliases: [],
  identityHints: [],
  space: { id: `space_${HEX_32}`, displayName: "People", kind: "people" },
  lifecycle: "active",
};

const source = {
  uri: "https://example.test/distilly-capacity-fixture",
  medium: "webpage",
  access: "public",
  capturedAt: "2026-08-31T00:00:00.000Z",
  authors: [],
};

const deterministicHex = (length, seed) => {
  let value = "";
  for (let counter = 0; value.length < length; counter += 1) {
    value += createHash("sha256")
      .update(`${seed}:${String(counter)}`)
      .digest("hex");
  }
  return value.slice(0, length);
};

const distributedContent = (length, markers, seed) => {
  const parts = markers.map((marker, index) => `M${String(index)}=${marker}`);
  const fixedLength =
    parts.reduce((total, part) => total + part.length, 0) + 2 * (parts.length - 1);
  const noiseLength = length - fixedLength;
  assert.ok(noiseLength >= 0, "capacity fixture is too small for distributed markers");
  const segmentCount = parts.length - 1;
  const baseLength = Math.floor(noiseLength / segmentCount);
  let remainder = noiseLength % segmentCount;
  let content = parts[0];
  for (let index = 1; index < parts.length; index += 1) {
    const segmentLength = baseLength + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    content += `|${deterministicHex(segmentLength, `${seed}:${String(index)}`)}|${parts[index]}`;
  }
  assert.equal(Buffer.byteLength(content, "utf8"), length);
  return content;
};

const fillToBytes = (factory, targetBytes, markers, seed) => {
  const empty = factory("");
  const contentBytes = targetBytes - Buffer.byteLength(JSON.stringify(empty), "utf8");
  assert.ok(contentBytes >= 0, "capacity fixture target is smaller than its fixed envelope");
  const value = factory(distributedContent(contentBytes, markers, seed));
  assert.equal(Buffer.byteLength(JSON.stringify(value), "utf8"), targetBytes);
  return value;
};

const positiveByteCount = (value, label) => {
  assert.ok(Number.isSafeInteger(value) && value > 0, `${label} must be a positive safe integer`);
  return value;
};

/**
 * Conservative bytes-per-token divisor for the probe's declared token limits.
 *
 * The probe measures BYTES the transport carried, which is the only quantity it can
 * observe. A token limit must be derived from that, never copied from it: declaring
 * a byte count as a token count overstates the budget by roughly this factor. The
 * divisor is deliberately pessimistic, so a dense script (where one token covers
 * one or two bytes) still yields a limit the host is known to carry.
 */
const BYTES_PER_TOKEN = 4;

/**
 * Converts a measured byte budget into the token limit the probe may declare.
 *
 * @param bytes - Positive byte budget the probe carries.
 * @returns A positive conservative token estimate.
 */
const conservativeTokens = (bytes) => Math.max(1, Math.floor(bytes / BYTES_PER_TOKEN));

/**
 * Creates a deterministic fixture at independently requested wire boundaries.
 * Host verifiers use this factory so a host-specific limit never changes the
 * canonical five-tool contract or the default Codex fixture.
 */
export const createHostCapacityFixture = ({
  briefingBytes = 65_536,
  toolResultBytes = 65_536,
} = {}) => {
  const targetBriefingBytes = positiveByteCount(briefingBytes, "briefingBytes");
  const targetToolResultBytes = positiveByteCount(toolResultBytes, "toolResultBytes");
  const briefingTokens = conservativeTokens(targetBriefingBytes);
  const toolResultTokens = conservativeTokens(targetToolResultBytes);
  const createBriefing = (content) => ({
    job: {
      id: JOB_ID,
      subjectId: SUBJECT_ID,
      generation: 1,
      materialSetHash: `set_sha256_${HEX_64}`,
      addedMaterialCount: 1,
      totalMaterialCount: 1,
      state: "leased",
      queuedAt: "2026-08-31T00:00:00.000Z",
      leaseExpiresAt: "2026-08-31T00:30:00.000Z",
    },
    lease: {
      id: `lease_${HEX_32}`,
      jobId: JOB_ID,
      generation: 1,
      briefContractDigest: `brief_contract_${HEX_64}`,
      owner: `lease_owner_${HEX_32}`,
      acquiredAt: "2026-08-31T00:00:00.000Z",
      expiresAt: "2026-08-31T00:30:00.000Z",
    },
    subject,
    materials: [
      {
        ref: "m001",
        materialId: `mat_${HEX_64}`,
        contentDigest: `sha256_${HEX_64}`,
        kind: "web",
        content,
        source,
        derivation: { kind: "native_text" },
        sourceGroup: {
          key: `sg_${HEX_64}`,
          bases: ["canonical_uri"],
          diversityStatus: "eligible",
          cautions: [],
        },
        sensitivity: "shareable",
      },
    ],
    contract: {
      digest: `brief_contract_${HEX_64}`,
      sourceGroupingVersion: "source-groups-v1",
      promptVersion: `host-distill-v1-sha256_${HEX_64}`,
      draftSchemaVersion: 1,
      instructions: "Read the complete fixture without truncation.",
      evidenceRules: ["Preserve every distributed capacity marker."],
    },
    limits: {
      estimatedInputTokens: briefingTokens,
      maximumInputTokens: briefingTokens,
      maximumOutputBytes: 65_536,
    },
  });
  const briefing = fillToBytes(
    createBriefing,
    targetBriefingBytes,
    BRIEF_MARKERS,
    "briefing-capacity-v1",
  );
  const promptOutput = (prompt) => ({
    ok: true,
    wireVersion: "3",
    value: { kind: "prompt", subject, prompt },
  });
  const promptEnvelope = fillToBytes(
    promptOutput,
    targetToolResultBytes,
    PROMPT_MARKERS,
    "prompt-capacity-v1",
  );
  return {
    targetBriefingBytes,
    targetToolResultBytes,
    briefingTokens,
    toolResultTokens,
    briefing,
    prompt: promptEnvelope.value.prompt,
    expectedPromptOutput: promptEnvelope,
    expectedBriefingOutput: {
      ok: true,
      wireVersion: "3",
      value: { kind: "briefing", briefing },
    },
    promptToolInput: {
      wireVersion: "3",
      requestId: `req_${"1".repeat(32)}`,
      action: "prompt",
      subject: { kind: "id", subjectId: SUBJECT_ID },
    },
    briefingToolInput: {
      wireVersion: "3",
      requestId: `req_${"2".repeat(32)}`,
      action: "brief",
      jobId: JOB_ID,
    },
  };
};

const defaultFixture = createHostCapacityFixture();
export const TARGET_BRIEFING_BYTES = defaultFixture.targetBriefingBytes;
export const TARGET_TOOL_RESULT_BYTES = defaultFixture.targetToolResultBytes;
export const expectedPromptOutput = defaultFixture.expectedPromptOutput;
export const expectedBriefingOutput = defaultFixture.expectedBriefingOutput;
export const promptToolInput = defaultFixture.promptToolInput;
export const briefingToolInput = defaultFixture.briefingToolInput;

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)))
      .map((key) => [key, canonicalize(value[key])]),
  );
};

export const canonicalJson = (value) => JSON.stringify(canonicalize(value));
export const sha256 = (value) => `sha256_${createHash("sha256").update(value).digest("hex")}`;

export const toolContractDigest = sha256(
  canonicalJson(
    distillyMcpTools.map(
      ({ name, title, description, inputSchema, outputSchema, annotations }) => ({
        name,
        title,
        description,
        inputSchema,
        outputSchema,
        annotations,
      }),
    ),
  ),
);

// The real-host probe intentionally describes marker extraction generically.
// It must never disclose the fixture's marker values in the model prompt: the
// model has to read the complete MCP result to return them. Keep this contract
// versioned and digest it into every host evidence record so a changed probe
// cannot reuse an older capacity observation.
const PROMPT_PROBE_TEMPLATE =
  "Call the MCP tool exactly once with this exact JSON object: {{input}}. " +
  "The result contains value.prompt with five distributed fields named M0 through M4. " +
  "Extract only the 32-character marker immediately after each field and stop at the next |. " +
  'Return only JSON exactly in this shape: {"markers":["M0 value","M1 value","M2 value","M3 value","M4 value"]}. ' +
  "Do not infer or guess missing data.";
const BRIEFING_PROBE_TEMPLATE =
  "Call the MCP tool exactly once with this exact JSON object: {{input}}. " +
  "In value.briefing.materials[0].content, extract only the 32-character marker immediately after each M0 through M4 field and stop at the next |. " +
  "Also copy value.briefing.limits.estimatedInputTokens. " +
  'Return only JSON exactly in this shape: {"markers":["M0 value","M1 value","M2 value","M3 value","M4 value"],"estimatedInputTokens":"copied number"}. ' +
  "Do not infer or guess missing data.";

const probeContract = Object.freeze({
  schemaVersion: 2,
  promptTool: "distilly_get",
  briefingTool: "distilly_pending",
  markerCount: 5,
  markerWidth: 32,
  promptTemplate: PROMPT_PROBE_TEMPLATE,
  briefingTemplate: BRIEFING_PROBE_TEMPLATE,
});

export const probeContractDigest = sha256(canonicalJson(probeContract));

export const promptProbeText = (input) =>
  PROMPT_PROBE_TEMPLATE.replace("{{input}}", JSON.stringify(input));

export const briefingProbeText = (input) =>
  BRIEFING_PROBE_TEMPLATE.replace("{{input}}", JSON.stringify(input));
