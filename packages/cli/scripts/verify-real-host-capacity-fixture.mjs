import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { constants, writeSync } from "node:fs";
import {
  access,
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  lstat,
  writeFile,
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { delimiter, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BRIEF_MARKERS,
  PROMPT_MARKERS,
  briefingProbeText,
  createHostCapacityFixture,
  canonicalJson,
  probeContractDigest,
  promptProbeText,
  sha256,
  toolContractDigest,
} from "./host-capacity-fixture-data.mjs";
import { advertisedToolContractDigest } from "@distilly/mcp/internal/schema";

const RELEASE_VERSION = "0.1.0-preview.1";
const EXPECTED_SKILL_DIGEST =
  "sha256_83b9b45faf76c184a5605b1ec6e2f7007d440813d3314f58a4250246c5de44a9";
const DEFAULTS = Object.freeze({
  openclaw: {
    executable: "openclaw",
    briefingBytes: 65_536,
    toolResultBytes: 65_536,
    model: "gpt-5.4",
    provider: "openai-codex",
    version: "OpenClaw 2026.3.24 (af6f32f)",
  },
  hermes: {
    executable: "hermes",
    briefingBytes: 49_752,
    toolResultBytes: 49_752,
    model: "gpt-5.4",
    provider: "openai-codex",
    version: "Hermes Agent v0.9.0 (2026.4.13)",
  },
});

const SAFE_ENVIRONMENT_KEYS = [
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "LC_MESSAGES",
  "TERM",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "SYSTEMROOT",
  "WINDIR",
  "PATHEXT",
];
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
const NODE_PATH = process.env.DISTILLY_NODE_PATH ?? process.execPath;

const prepareIsolationPaths = async (root) => {
  const paths = {
    tmp: join(root, "tmp"),
    runtime: join(root, "runtime"),
    config: join(root, "xdg-config"),
    data: join(root, "xdg-data"),
  };
  await Promise.all(
    Object.values(paths).map((path) => mkdir(path, { recursive: true, mode: 0o700 })),
  );
  return paths;
};

const safeBaseEnvironment = (home, hostDirectory, isolationPaths) => {
  const environment = {};
  for (const key of SAFE_ENVIRONMENT_KEYS) {
    const value = process.env[key];
    if (value !== undefined) environment[key] = value;
  }
  environment.HOME = home;
  environment.USERPROFILE = home;
  environment.PATH = [dirname(NODE_PATH), hostDirectory, "/usr/bin", "/bin"]
    .filter(Boolean)
    .join(delimiter);
  environment.TMPDIR = isolationPaths.tmp;
  environment.TMP = isolationPaths.tmp;
  environment.TEMP = isolationPaths.tmp;
  environment.XDG_RUNTIME_DIR = isolationPaths.runtime;
  environment.XDG_CONFIG_HOME = isolationPaths.config;
  environment.XDG_DATA_HOME = isolationPaths.data;
  environment.XDG_CONFIG_DIRS = isolationPaths.config;
  environment.XDG_DATA_DIRS = isolationPaths.data;
  environment.NODE_NO_WARNINGS = "1";
  return environment;
};

const positiveInteger = (value, name) => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive safe integer.`);
  }
  return parsed;
};

const parseArguments = (host) => {
  const defaults = DEFAULTS[host];
  const result = {
    briefingBytes: defaults.briefingBytes,
    toolResultBytes: defaults.toolResultBytes,
  };
  for (let index = 3; index < process.argv.length; index += 1) {
    const option = process.argv[index];
    const value = process.argv[index + 1];
    if (option === "--briefing-bytes" && value !== undefined) {
      result.briefingBytes = positiveInteger(value, "--briefing-bytes");
      index += 1;
    } else if (option === "--tool-result-bytes" && value !== undefined) {
      result.toolResultBytes = positiveInteger(value, "--tool-result-bytes");
      index += 1;
    } else {
      throw new Error(
        "Usage: verify-real-host-capacity-fixture.mjs openclaw|hermes [--briefing-bytes N] [--tool-result-bytes N]",
      );
    }
  }
  return result;
};

const executableFromPath = async (name, override) => {
  const candidates =
    override === undefined ? (process.env.PATH ?? "").split(delimiter) : [override];
  for (const directoryOrPath of candidates) {
    const candidate = override === undefined ? join(directoryOrPath, name) : directoryOrPath;
    if (!isAbsolute(candidate)) continue;
    try {
      await access(candidate, constants.X_OK);
      return await realpath(candidate);
    } catch {
      // Try the next explicit path entry.
    }
  }
  throw new Error(`Could not find the real ${name} executable on PATH.`);
};

const runProcess = (executable, args, options = {}) =>
  new Promise((resolvePromise, reject) => {
    const child = spawn(executable, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    let outputBytes = 0;
    let timedOut = false;
    let settled = false;
    const collect = (target, chunk) => {
      if (outputBytes >= MAX_OUTPUT_BYTES) return;
      const bytes = Buffer.from(chunk);
      const remaining = MAX_OUTPUT_BYTES - outputBytes;
      target.push(bytes.subarray(0, remaining));
      outputBytes += Math.min(bytes.length, remaining);
      if (bytes.length > remaining) child.kill("SIGKILL");
    };
    child.stdout.on("data", (chunk) => collect(stdout, chunk));
    child.stderr.on("data", (chunk) => collect(stderr, chunk));
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, options.timeoutMs ?? 300_000);
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolvePromise({
        exitCode: code ?? 1,
        signal,
        timedOut,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
    child.stdin.end(options.input ?? "", "utf8");
  });

const assertProcessSucceeded = (result, label) => {
  assert.equal(result.timedOut, false, `${label} timed out`);
  assert.equal(result.exitCode, 0, `${label} exited unsuccessfully`);
  assert.equal(result.signal, null, `${label} was terminated`);
};

const hostVersion = async (host, executable, environment) => {
  const result = await runProcess(executable, ["--version"], {
    env: environment,
    timeoutMs: host === "hermes" ? 30_000 : 10_000,
  });
  assertProcessSucceeded(result, `${host} --version`);
  const lines = result.stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const hermesVersions = lines.filter((line) =>
    /^Hermes Agent v\S+(?:\s+\([^\r\n]+\))?$/u.test(line),
  );
  const version =
    host === "hermes"
      ? hermesVersions.length === 1
        ? hermesVersions[0]
        : undefined
      : lines.length === 1
        ? lines[0]
        : undefined;
  if (version === undefined || result.stderr.trim() !== "") {
    throw new Error(`${host} returned an invalid version probe.`);
  }
  return version;
};

const copySecretFile = async (source, destination) => {
  let metadata;
  try {
    metadata = await lstat(source);
    await access(source, constants.R_OK);
  } catch {
    throw new Error(`Required local host credential file is unavailable: ${source}`);
  }
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error(`Required local host credential path is not a regular file: ${source}`);
  }
  await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
  await copyFile(source, destination);
  await chmod(destination, 0o600);
};

const readableRegularFile = async (path, label) => {
  const metadata = await lstat(path);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error(`${label} is not a regular file.`);
  }
  await access(path, constants.R_OK);
  return path;
};

const assertContainedPath = (parentRealPath, childRealPath, label) => {
  const childRelativePath = relative(parentRealPath, childRealPath);
  if (
    childRelativePath.length === 0 ||
    childRelativePath === ".." ||
    childRelativePath.startsWith(`..${sep}`) ||
    isAbsolute(childRelativePath)
  ) {
    throw new Error(`${label} escaped its isolated directory.`);
  }
};

const readableSessionDirectory = async (directory, containmentRoot, label) => {
  const rootRealPath = await realpath(containmentRoot);
  const metadata = await lstat(directory);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error(`${label} is not an ordinary directory.`);
  }
  const directoryRealPath = await realpath(directory);
  assertContainedPath(rootRealPath, directoryRealPath, label);
  return directoryRealPath;
};

const findSessionFile = async (directory, sessionId, suffixes, containmentRoot) => {
  const directoryRealPath = await readableSessionDirectory(
    directory,
    containmentRoot,
    "The host session directory",
  );
  const expected = suffixes.map((suffix) => join(directory, `${sessionId}${suffix}`));
  for (const path of expected) {
    try {
      await readableRegularFile(path, "The host session transcript");
      const candidateRealPath = await realpath(path);
      assertContainedPath(directoryRealPath, candidateRealPath, "The host session transcript");
      if (dirname(candidateRealPath) !== directoryRealPath) {
        throw new Error("The host session transcript escaped its session directory.");
      }
      return candidateRealPath;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      // Try the next exact session filename.
    }
  }
  throw new Error("The host did not persist the expected readable session transcript.");
};

const readOpenClawEvents = async (path) => {
  const text = await readFile(path, "utf8");
  return text
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
};

const readHermesSession = async (path, expectedSessionId) => {
  const value = JSON.parse(await readFile(path, "utf8"));
  if (Array.isArray(value)) {
    // Hermes v0.9.0 persists a bare message array. The exact CLI-derived
    // filename, freshly cleared sessions directory, and containment checks
    // above are the available session-identity proof for this format.
    return value;
  }
  if (value !== null && typeof value === "object" && Array.isArray(value.messages)) {
    assert.equal(
      value.session_id,
      expectedSessionId,
      "Hermes persisted a transcript for a different session.",
    );
    return value.messages;
  }
  throw new Error("The Hermes session transcript has an unsupported shape.");
};

const hermesSessionPath = async (hermesHome, sessionId, containmentRoot) => {
  if (!/^[A-Za-z0-9_-]{1,160}$/u.test(sessionId)) {
    throw new Error("Hermes returned an invalid session id.");
  }
  const hermesRootRealPath = await realpath(containmentRoot);
  const hermesMetadata = await lstat(hermesHome);
  if (!hermesMetadata.isDirectory() || hermesMetadata.isSymbolicLink()) {
    throw new Error("Hermes home is not an ordinary directory.");
  }
  const hermesHomeRealPath = await realpath(hermesHome);
  assertContainedPath(hermesRootRealPath, hermesHomeRealPath, "Hermes home");
  const sessionsRoot = join(hermesHome, "sessions");
  const sessionsMetadata = await lstat(sessionsRoot);
  if (!sessionsMetadata.isDirectory() || sessionsMetadata.isSymbolicLink()) {
    throw new Error("Hermes sessions directory is not an ordinary directory.");
  }
  const sessionsRootRealPath = await realpath(sessionsRoot);
  assertContainedPath(hermesHomeRealPath, sessionsRootRealPath, "Hermes sessions directory");
  const candidate = join(sessionsRoot, `session_${sessionId}.json`);
  const candidateRealPath = await realpath(candidate);
  await readableRegularFile(candidate, "The Hermes session transcript");
  assertContainedPath(sessionsRootRealPath, candidateRealPath, "Hermes session transcript");
  if (dirname(candidateRealPath) !== sessionsRootRealPath) {
    throw new Error("Hermes session transcript escaped its session directory.");
  }
  return candidateRealPath;
};

const textContent = (value) => {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return undefined;
  const texts = value
    .filter((entry) => entry !== null && typeof entry === "object" && entry.type === "text")
    .map((entry) => entry.text)
    .filter((entry) => typeof entry === "string");
  return texts.length === 0 ? undefined : texts.join("\n");
};

const candidateResult = (message) => {
  const details = message.details;
  const structured =
    details?.structuredContent ??
    details?.structured_content ??
    message.structuredContent ??
    message.structured_content;
  const text = textContent(message.content);
  if (structured !== undefined && text !== undefined) return { structured, text };
  if (typeof message.content === "string") {
    try {
      const wrapper = JSON.parse(message.content);
      if (
        wrapper !== null &&
        typeof wrapper === "object" &&
        typeof wrapper.result === "string" &&
        wrapper.structuredContent !== undefined
      ) {
        return { structured: wrapper.structuredContent, text: wrapper.result };
      }
    } catch {
      // This is an ordinary assistant/tool message, not the serialized MCP result.
    }
  }
  return undefined;
};

const parseFinalJson = (value) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().replace(/^```(?:json)?\s*|\s*```$/gu, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
};

const parseToolArguments = (value) => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

const asToolCallArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const extractToolCalls = (message) => {
  const calls = [];
  const add = (id, name, rawArguments) => {
    if (typeof name !== "string") return;
    const argumentsValue = parseToolArguments(rawArguments);
    calls.push({ id, name, arguments: argumentsValue });
  };

  if (Array.isArray(message.content)) {
    for (const block of message.content) {
      if (block === null || typeof block !== "object") continue;
      if (block.type === "toolCall") {
        add(block.id, block.name, block.arguments ?? block.partialJson);
      } else if (block.type === "tool_use") {
        add(block.id, block.name, block.input);
      }
    }
  }

  for (const call of asToolCallArray(message.tool_calls)) {
    if (call === null || typeof call !== "object") continue;
    const functionCall =
      call.function !== null && typeof call.function === "object" ? call.function : call;
    add(
      call.id,
      functionCall.name ?? call.name,
      functionCall.arguments ?? call.arguments ?? call.input,
    );
  }
  return calls;
};

const toolNameMatches = (actual, expected) => {
  if (typeof actual !== "string") return false;
  return (
    actual === expected ||
    actual === `distilly_capacity_probe_${expected}` ||
    actual === `distilly_capacity_probe__${expected}` ||
    actual === `mcp_distilly_capacity_probe_${expected}` ||
    actual === `mcp__distilly_capacity_probe__${expected}`
  );
};

const consistentStringAliases = (message, keys, label) => {
  const values = keys.filter((key) => key in message).map((key) => message[key]);
  if (values.length === 0) return undefined;
  if (!values.every((value) => typeof value === "string" && value.length > 0)) {
    throw new Error(`${label} contains an invalid alias value.`);
  }
  if (new Set(values).size !== 1) throw new Error(`${label} aliases disagree.`);
  return values[0];
};

const toolResultCallId = (message) =>
  consistentStringAliases(
    message,
    ["toolCallId", "tool_call_id", "toolUseId", "tool_use_id"],
    "Tool-result call id",
  );

const toolResultName = (message) =>
  consistentStringAliases(message, ["toolName", "tool_name"], "Tool-result name");

const findObservation = (messages, expected, expectedFinal, toolName, expectedInput) => {
  const results = [];
  const assistants = [];
  const calls = [];
  for (const [index, event] of messages.entries()) {
    const message = event?.message ?? event;
    if (message === null || typeof message !== "object") continue;
    calls.push(...extractToolCalls(message));
    if (message.role === "toolResult" || message.role === "tool") {
      const result = candidateResult(message);
      const callId = toolResultCallId(message);
      if (result !== undefined) {
        results.push({
          index,
          ...result,
          callId,
          name: toolResultName(message),
          isError: message.isError,
        });
      }
    }
    if (message.role === "assistant") {
      const text = textContent(message.content) ?? message.content;
      const parsed = parseFinalJson(text);
      if (parsed !== undefined) assistants.push({ index, value: parsed });
    }
    if (event?.item?.type === "agent_message") {
      const parsed = parseFinalJson(event.item.text);
      if (parsed !== undefined) assistants.push({ index, value: parsed });
    }
  }
  const matchingCalls = calls.filter((call) => toolNameMatches(call.name, toolName));
  assert.equal(
    matchingCalls.length,
    1,
    `Expected exactly one ${toolName} call with a persisted id`,
  );
  const [call] = matchingCalls;
  assert.equal(typeof call.id, "string", `The ${toolName} call did not include a persisted id`);
  assert.ok(call.id.length > 0, `The ${toolName} call did not include a persisted id`);
  assert.equal(
    canonicalJson(call.arguments),
    canonicalJson(expectedInput),
    `The ${toolName} call arguments did not match the probe input`,
  );
  const callResults = results.filter((result) => result.callId === call.id);
  assert.equal(
    callResults.length,
    1,
    `Expected exactly one result correlated to the ${toolName} call`,
  );
  const correlatedResult = callResults[0];
  assert.ok(
    correlatedResult.name === undefined || toolNameMatches(correlatedResult.name, toolName),
    `The result correlated to ${toolName} had a different tool name`,
  );
  assert.notEqual(correlatedResult.isError, true, `${toolName} returned an error result`);
  const matches = [correlatedResult].filter(
    (result) => canonicalJson(result.structured) === canonicalJson(expected),
  );
  assert.equal(
    matches.length,
    1,
    `Expected exactly one complete ${toolName} result in the transcript`,
  );
  const result = matches[0];
  assert.equal(result.text.includes("[Truncated:"), false, `${toolName} result was truncated`);
  assert.equal(
    result.text.includes("<persisted-output>"),
    false,
    `${toolName} result was persisted externally`,
  );
  assert.equal(canonicalJson(JSON.parse(result.text)), canonicalJson(result.structured));
  const finalCandidate = assistants.find(
    ({ index, value }) =>
      index > correlatedResult.index && canonicalJson(value) === canonicalJson(expectedFinal),
  );
  assert.ok(
    finalCandidate !== undefined,
    `The host model did not return the complete ${toolName} marker set`,
  );
  return { result, finalValue: finalCandidate.value };
};

const verifyObservations = (fixture, promptObservation, briefingObservation) => {
  assert.equal(
    briefingObservation.result.structured.value.briefing.limits.maximumOutputBytes,
    65_536,
    "The briefing fixture must retain the product patch-output limit",
  );
  assert.equal(
    Buffer.byteLength(promptObservation.result.text, "utf8"),
    fixture.targetToolResultBytes,
  );
  assert.equal(
    Buffer.byteLength(JSON.stringify(promptObservation.result.structured), "utf8"),
    fixture.targetToolResultBytes,
  );
  assert.equal(
    Buffer.byteLength(JSON.stringify(briefingObservation.result.structured.value.briefing), "utf8"),
    fixture.targetBriefingBytes,
  );
};

const releaseTuple = async (repositoryRoot) => {
  const manifest = JSON.parse(
    await readFile(join(repositoryRoot, "plugins", "release-manifest.json"), "utf8"),
  );
  assert.equal(manifest.releaseVersion, RELEASE_VERSION);
  assert.equal(manifest.canonicalSkill.digest, EXPECTED_SKILL_DIGEST);
  return {
    releaseVersion: manifest.releaseVersion,
    canonicalSkillDigest: manifest.canonicalSkill.digest,
  };
};

const evidence = ({ host, version, fixture, normalized }) => {
  const tuple = {
    fixtureId: `${host === "openclaw" ? "openclaw-2026.3.24" : "hermes-agent-v0.9.0"}-cli-distilly-${RELEASE_VERSION}-v2`,
    host,
    hostVersion: version,
    environment: "cli",
    releaseVersion: RELEASE_VERSION,
    wireMajor: 3,
    canonicalSkillDigest: EXPECTED_SKILL_DIGEST,
    toolContractDigest,
    schemaProfile: host,
    advertisedToolContractDigest: advertisedToolContractDigest(host),
    probeContractDigest,
    serializer: "structured-content-plus-json-text-v1",
    capacity: {
      // Bytes the probe actually carried, and the token limit derived from them. The
      // earlier record copied the byte count into a token field, which overstated the
      // budget; the two quantities are now named and derived separately.
      boundKind: "verified_lower_bound",
      verifiedBriefingBytes: fixture.targetBriefingBytes,
      estimatedInputTokens: fixture.briefingTokens,
      maximumToolResultBytes: fixture.targetToolResultBytes,
      estimatedToolResultTokens: fixture.toolResultTokens,
    },
  };
  return {
    schemaVersion: 1,
    ...tuple,
    observed: {
      briefingBytes: fixture.targetBriefingBytes,
      toolResultBytes: fixture.targetToolResultBytes,
      structuredTextDeepEqual: true,
      modelObservedBothTailMarkers: true,
      normalizedTranscriptDigest: sha256(canonicalJson({ tuple, ...normalized })),
    },
    verifiedAt: new Date().toISOString(),
  };
};

const setupOpenClaw = async (root, executable, serverPath, fixture) => {
  const home = join(root, "home");
  const isolationPaths = await prepareIsolationPaths(root);
  const state = join(home, ".openclaw");
  const workspace = join(root, "workspace");
  const hostDirectory = dirname(executable);
  await mkdir(join(state, "agents", "main", "agent"), { recursive: true, mode: 0o700 });
  await mkdir(workspace, { recursive: true, mode: 0o700 });
  const sourceRoot = process.env.DISTILLY_OPENCLAW_HOME ?? join(homedir(), ".openclaw");
  await copySecretFile(
    process.env.DISTILLY_OPENCLAW_AUTH_PROFILES ??
      join(sourceRoot, "agents/main/agent/auth-profiles.json"),
    join(state, "agents/main/agent/auth-profiles.json"),
  );
  const environment = safeBaseEnvironment(home, hostDirectory, isolationPaths);
  environment.OPENCLAW_STATE_DIR = state;
  environment.OPENCLAW_CONFIG_PATH = join(state, "openclaw.json");
  const serverEnvironment = {
    DISTILLY_FIXTURE_BRIEFING_BYTES: String(fixture.targetBriefingBytes),
    DISTILLY_FIXTURE_TOOL_RESULT_BYTES: String(fixture.targetToolResultBytes),
    DISTILLY_MCP_SCHEMA_PROFILE: "openclaw",
  };
  await writeFile(
    environment.OPENCLAW_CONFIG_PATH,
    `${JSON.stringify(
      {
        meta: { lastTouchedVersion: "2026.3.24" },
        agents: {
          defaults: {
            model: {
              primary: `${DEFAULTS.openclaw.provider}/${DEFAULTS.openclaw.model}`,
            },
            workspace,
            compaction: { mode: "safeguard" },
          },
        },
        plugins: { enabled: false },
        tools: {
          profile: "minimal",
          deny: [
            "group:runtime",
            "group:fs",
            "group:web",
            "group:memory",
            "group:sessions",
            "group:ui",
            "group:messaging",
            "group:automation",
            "group:nodes",
            "group:agents",
            "group:media",
          ],
        },
        mcp: {
          servers: {
            distilly_capacity_probe: {
              command: NODE_PATH,
              args: [serverPath],
              env: serverEnvironment,
            },
          },
        },
        gateway: { mode: "local", bind: "loopback" },
      },
      undefined,
      2,
    )}\n`,
    { mode: 0o600 },
  );
  const run = async (id, prompt) => {
    const sessions = join(state, "agents/main/sessions");
    await rm(sessions, { recursive: true, force: true });
    await mkdir(sessions, { recursive: true, mode: 0o700 });
    const result = await runProcess(
      executable,
      [
        "agent",
        "--local",
        "--json",
        "--agent",
        "main",
        "--session-id",
        id,
        "--thinking",
        "off",
        "--timeout",
        "180",
        "-m",
        prompt,
      ],
      { env: environment, cwd: workspace, timeoutMs: 360_000 },
    );
    assertProcessSucceeded(result, `OpenClaw ${id}`);
    const path = await findSessionFile(sessions, id, [".jsonl"], root);
    const events = await readOpenClawEvents(path);
    const session = events.find((event) => event?.type === "session");
    assert.equal(session?.id, id, "OpenClaw persisted a different session transcript.");
    return events;
  };
  return { home, environment, run };
};

const setupHermes = async (root, executable, serverPath, fixture) => {
  const home = join(root, "home");
  const isolationPaths = await prepareIsolationPaths(root);
  const hermesHome = join(home, ".hermes");
  const hostDirectory = dirname(executable);
  await mkdir(hermesHome, { recursive: true, mode: 0o700 });
  const sourceRoot = process.env.DISTILLY_HERMES_HOME ?? join(homedir(), ".hermes");
  await copySecretFile(
    process.env.DISTILLY_HERMES_AUTH ?? join(sourceRoot, "auth.json"),
    join(hermesHome, "auth.json"),
  );
  await copySecretFile(
    process.env.DISTILLY_HERMES_ENV ?? join(sourceRoot, ".env"),
    join(hermesHome, ".env"),
  );
  const environment = safeBaseEnvironment(home, hostDirectory, isolationPaths);
  environment.HERMES_HOME = hermesHome;
  const serverEnv = [
    `DISTILLY_FIXTURE_BRIEFING_BYTES=${fixture.targetBriefingBytes}`,
    `DISTILLY_FIXTURE_TOOL_RESULT_BYTES=${fixture.targetToolResultBytes}`,
    "DISTILLY_MCP_SCHEMA_PROFILE=hermes",
  ];
  const added = await runProcess(
    executable,
    [
      "mcp",
      "add",
      "distilly_capacity_probe",
      "--command",
      NODE_PATH,
      "--env",
      ...serverEnv,
      "--args",
      serverPath,
    ],
    { env: environment, cwd: home, input: "y\n", timeoutMs: 120_000 },
  );
  assertProcessSucceeded(added, "Hermes MCP setup");
  assert.match(added.stdout, /(?:Found 5 tool|5\/5 tools enabled)/u);
  const run = async (prompt) => {
    const sessions = join(hermesHome, "sessions");
    await rm(sessions, { recursive: true, force: true });
    await mkdir(sessions, { recursive: true, mode: 0o700 });
    const result = await runProcess(
      executable,
      [
        "chat",
        "-q",
        prompt,
        "--provider",
        DEFAULTS.hermes.provider,
        "-m",
        DEFAULTS.hermes.model,
        "-t",
        "distilly_capacity_probe",
        "--max-turns",
        "4",
        "-Q",
        "--source",
        "tool",
      ],
      { env: environment, cwd: home, timeoutMs: 360_000 },
    );
    assertProcessSucceeded(result, "Hermes capacity session");
    const sessionId = result.stdout.match(/session_id:\s*(\S+)/u)?.[1];
    if (sessionId === undefined) throw new Error("Hermes did not report a session id.");
    const path = await hermesSessionPath(hermesHome, sessionId, root);
    return readHermesSession(path, sessionId);
  };
  return { home, environment, run };
};

const verifyRealHostCapacityFixture = async (host, options = {}) => {
  if (host !== "openclaw" && host !== "hermes") {
    throw new Error("The real-host verifier supports openclaw or hermes.");
  }
  const packageRoot = fileURLToPath(new URL("..", import.meta.url));
  const repositoryRoot = resolve(packageRoot, "../..");
  const tuple = await releaseTuple(repositoryRoot);
  const defaults = DEFAULTS[host];
  const fixture = createHostCapacityFixture({
    briefingBytes: options.briefingBytes ?? defaults.briefingBytes,
    toolResultBytes: options.toolResultBytes ?? defaults.toolResultBytes,
  });
  const executable = await executableFromPath(
    defaults.executable,
    process.env[`DISTILLY_${host.toUpperCase()}_PATH`],
  );
  const hostDirectory = dirname(executable);
  const versionHome = await mkdtemp(join(tmpdir(), `distilly-${host}-version-`));
  const versionIsolation = await prepareIsolationPaths(versionHome);
  const versionEnvironment = safeBaseEnvironment(versionHome, hostDirectory, versionIsolation);
  if (host === "openclaw") {
    versionEnvironment.OPENCLAW_STATE_DIR = join(versionHome, ".openclaw");
    versionEnvironment.OPENCLAW_CONFIG_PATH = join(versionHome, ".openclaw", "openclaw.json");
  } else {
    versionEnvironment.HERMES_HOME = join(versionHome, ".hermes");
  }
  let version;
  try {
    version = await hostVersion(host, executable, versionEnvironment);
  } finally {
    await rm(versionHome, { recursive: true, force: true });
  }
  assert.equal(
    version,
    defaults.version,
    `Installed ${host} version is not the recorded fixture version.`,
  );
  const serverPath = join(packageRoot, "scripts", "host-capacity-fixture-server.mjs");
  const root = await mkdtemp(join(tmpdir(), `distilly-${host}-capacity-`));
  try {
    const setup =
      host === "openclaw"
        ? await setupOpenClaw(root, executable, serverPath, fixture)
        : await setupHermes(root, executable, serverPath, fixture);
    const promptFixture = {
      promptToolInput: fixture.promptToolInput,
      expected: { markers: [...PROMPT_MARKERS] },
    };
    const briefingFixture = {
      briefingToolInput: fixture.briefingToolInput,
      expected: {
        markers: [...BRIEF_MARKERS],
        // The probe payload declares a token limit derived from the carried bytes, so the
        // model must echo the derived value rather than the byte count it used to echo.
        estimatedInputTokens: String(fixture.briefingTokens),
      },
    };
    const promptPrompt = promptProbeText(promptFixture.promptToolInput);
    const promptMessages =
      host === "openclaw"
        ? await setup.run(`${host}-prompt-capacity-${randomUUID()}`, promptPrompt)
        : await setup.run(promptPrompt);
    const promptObservation = findObservation(
      promptMessages,
      fixture.expectedPromptOutput,
      promptFixture.expected,
      "distilly_get",
      promptFixture.promptToolInput,
    );
    const briefingPrompt = briefingProbeText(briefingFixture.briefingToolInput);
    const briefingMessages =
      host === "openclaw"
        ? await setup.run(`${host}-briefing-capacity-${randomUUID()}`, briefingPrompt)
        : await setup.run(briefingPrompt);
    const briefingObservation = findObservation(
      briefingMessages,
      fixture.expectedBriefingOutput,
      briefingFixture.expected,
      "distilly_pending",
      briefingFixture.briefingToolInput,
    );
    verifyObservations(fixture, promptObservation, briefingObservation);
    const record = evidence({
      host,
      version,
      fixture,
      normalized: {
        promptResult: promptObservation.result.structured,
        promptFinal: promptObservation.finalValue,
        briefingResult: briefingObservation.result.structured,
        briefingFinal: briefingObservation.finalValue,
      },
    });
    assert.equal(record.releaseVersion, tuple.releaseVersion);
    assert.equal(record.canonicalSkillDigest, tuple.canonicalSkillDigest);
    return record;
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

const host = process.argv[2];
export const realHostVerification =
  host === "openclaw" || host === "hermes"
    ? await verifyRealHostCapacityFixture(host, parseArguments(host))
    : undefined;

if (
  realHostVerification !== undefined &&
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  writeSync(process.stdout.fd, `${JSON.stringify(realHostVerification, undefined, 2)}\n`);
}
