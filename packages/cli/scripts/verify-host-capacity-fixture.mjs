import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { constants, writeSync } from "node:fs";
import { access, readFile, realpath } from "node:fs/promises";
import { delimiter, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BRIEF_MARKERS,
  PROMPT_MARKERS,
  TARGET_BRIEFING_BYTES,
  TARGET_TOOL_RESULT_BYTES,
  briefingToolInput,
  canonicalJson,
  expectedBriefingOutput,
  expectedPromptOutput,
  promptToolInput,
  sha256,
  toolContractDigest,
} from "./host-capacity-fixture-data.mjs";

const host = process.argv[2];
const runLegacyVerification = async () => {
  if (host !== "codex" && host !== "claude-code") {
    throw new Error("Usage: verify-host-capacity-fixture.mjs codex|claude-code|openclaw|hermes");
  }

  const packageRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
  const repositoryRoot = resolve(packageRoot, "../..");
  const serverPath = join(packageRoot, "scripts", "host-capacity-fixture-server.mjs");
  const releaseManifest = JSON.parse(
    await readFile(join(repositoryRoot, "plugins", "release-manifest.json"), "utf8"),
  );

  const executableName = host === "codex" ? "codex" : "claude";
  const executablePath = await (async () => {
    for (const directory of (process.env.PATH ?? "").split(delimiter)) {
      if (!isAbsolute(directory)) continue;
      const candidate = join(directory, executableName);
      try {
        await access(candidate, constants.X_OK);
        return await realpath(candidate);
      } catch {
        // Continue through explicit PATH entries.
      }
    }
    throw new Error(`Could not find ${executableName} on PATH.`);
  })();

  const run = (args, timeoutMs = 300_000) =>
    new Promise((resolvePromise, reject) => {
      const child = spawn(executablePath, args, {
        cwd: repositoryRoot,
        env: { ...process.env, NODE_NO_WARNINGS: "1" },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      let bufferFailure;
      const maximumBytes = 8 * 1024 * 1024;
      const collect = (target, chunk) => {
        const next = target + chunk.toString("utf8");
        if (Buffer.byteLength(next, "utf8") > maximumBytes) {
          bufferFailure = new Error("Host capacity fixture output exceeded its bounded buffer.");
          child.kill("SIGKILL");
          return target;
        }
        return next;
      };
      child.stdout.on("data", (chunk) => {
        stdout = collect(stdout, chunk);
      });
      child.stderr.on("data", (chunk) => {
        stderr = collect(stderr, chunk);
      });
      const timeout = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
      child.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once("close", (code, signal) => {
        clearTimeout(timeout);
        if (bufferFailure !== undefined) {
          reject(bufferFailure);
          return;
        }
        if (code !== 0) {
          reject(
            new Error(
              `${executableName} capacity fixture failed (${String(code ?? signal)}): ${stderr.slice(-2_000)}`,
            ),
          );
          return;
        }
        resolvePromise({ stdout, stderr });
      });
    });

  const versionRun = await run(["--version"], 5_000);
  assert.equal(versionRun.stderr, "");
  const hostVersion = versionRun.stdout.trim();
  assert.equal(
    hostVersion,
    host === "codex" ? "codex-cli 0.146.0" : "2.1.220 (Claude Code)",
    "the installed host version does not match this immutable fixture",
  );

  const claudeConfig = JSON.stringify({
    mcpServers: {
      distilly_capacity_probe: { command: process.execPath, args: [serverPath] },
    },
  });
  const hostArgs = (fixturePrompt) =>
    host === "codex"
      ? [
          "exec",
          "--ephemeral",
          "--ignore-user-config",
          "--skip-git-repo-check",
          "--sandbox",
          "read-only",
          "--json",
          "-c",
          `mcp_servers.distilly_capacity_probe.command=${JSON.stringify(process.execPath)}`,
          "-c",
          `mcp_servers.distilly_capacity_probe.args=[${JSON.stringify(serverPath)}]`,
          fixturePrompt,
        ]
      : [
          "-p",
          "--no-session-persistence",
          "--strict-mcp-config",
          "--mcp-config",
          claudeConfig,
          "--allowedTools",
          "mcp__distilly_capacity_probe__distilly_get,mcp__distilly_capacity_probe__distilly_pending",
          "--permission-mode",
          "dontAsk",
          "--output-format",
          "stream-json",
          "--verbose",
          "--model",
          "sonnet",
          "--max-budget-usd",
          "0.50",
          fixturePrompt,
        ];

  const parseInvocation = (invocation, expectedOutput, expectedFinal) => {
    const events = invocation.stdout
      .split("\n")
      .filter((line) => line.trim().startsWith("{"))
      .map((line) => JSON.parse(line));
    const toolResults = [];
    const visit = (value) => {
      if (value === null || typeof value !== "object") return;
      if (Array.isArray(value)) {
        for (const item of value) visit(item);
        return;
      }
      const structured = value.structuredContent ?? value.structured_content;
      if (
        structured !== undefined &&
        Array.isArray(value.content) &&
        value.content.length === 1 &&
        value.content[0]?.type === "text" &&
        typeof value.content[0].text === "string"
      ) {
        toolResults.push({ structured, text: value.content[0].text });
      }
      for (const nested of Object.values(value)) visit(nested);
    };
    for (const event of events) visit(event);
    const result = toolResults.find(
      ({ structured }) => canonicalJson(structured) === canonicalJson(expectedOutput),
    );
    assert.ok(result, "host event did not preserve the exact boundary result");
    assert.deepEqual(JSON.parse(result.text), result.structured);

    const assistantTexts = [];
    for (const event of events) {
      if (event.type === "item.completed" && event.item?.type === "agent_message") {
        assistantTexts.push(event.item.text);
      }
      if (event.type === "assistant" && Array.isArray(event.message?.content)) {
        for (const block of event.message.content) {
          if (block.type === "text") assistantTexts.push(block.text);
        }
      }
    }
    const finalValue = assistantTexts
      .map((text) => {
        try {
          return JSON.parse(text.trim().replace(/^```json\s*|\s*```$/gu, ""));
        } catch {
          return undefined;
        }
      })
      .find((value) => canonicalJson(value) === canonicalJson(expectedFinal));
    assert.ok(
      finalValue,
      `the host model did not report every unseen distributed marker: ${JSON.stringify(assistantTexts.slice(-3))}`,
    );
    return { result, finalValue };
  };

  const promptInvocation = await run(
    hostArgs(`Call distilly_get exactly once with this exact JSON object: ${JSON.stringify(promptToolInput)}

Return only this compact JSON shape, copying in order every value after M0= through M4= from value.prompt:
{"markers":["M0 value","M1 value","M2 value","M3 value","M4 value"]}

Do not infer or guess missing data.`),
  );
  const promptObservation = parseInvocation(promptInvocation, expectedPromptOutput, {
    markers: PROMPT_MARKERS,
  });
  assert.equal(Buffer.byteLength(promptObservation.result.text, "utf8"), TARGET_TOOL_RESULT_BYTES);
  assert.equal(
    Buffer.byteLength(JSON.stringify(promptObservation.result.structured), "utf8"),
    TARGET_TOOL_RESULT_BYTES,
  );

  const briefingInvocation = await run(
    hostArgs(`Call distilly_pending exactly once with this exact JSON object: ${JSON.stringify(briefingToolInput)}

Return only this compact JSON shape, copying in order every value after M0= through M4= from value.briefing.materials[0].content and the numeric limits.estimatedInputTokens value:
{"markers":["M0 value","M1 value","M2 value","M3 value","M4 value"],"estimatedInputTokens":"copied number"}

Do not infer or guess missing data.`),
  );
  const briefingObservation = parseInvocation(briefingInvocation, expectedBriefingOutput, {
    markers: BRIEF_MARKERS,
    estimatedInputTokens: String(TARGET_BRIEFING_BYTES),
  });
  assert.equal(
    Buffer.byteLength(JSON.stringify(briefingObservation.result.structured.value.briefing), "utf8"),
    TARGET_BRIEFING_BYTES,
  );

  const fixtureId =
    host === "codex"
      ? `codex-cli-0.146.0-cli-distilly-${releaseManifest.releaseVersion}-v1`
      : `claude-code-2.1.220-cli-distilly-${releaseManifest.releaseVersion}-v1`;
  const tuple = {
    fixtureId,
    host,
    hostVersion,
    environment: "cli",
    releaseVersion: releaseManifest.releaseVersion,
    wireMajor: 3,
    canonicalSkillDigest: releaseManifest.canonicalSkill.digest,
    toolContractDigest,
    serializer: "structured-content-plus-json-text-v1",
    capacity: {
      // The token budget is derived from the carried bytes; the byte budget keeps the
      // measured figure. Copying bytes into the token field overstated the budget.
      maximumInputTokens: Math.max(1, Math.floor(TARGET_BRIEFING_BYTES / 4)),
      maximumInputBytes: TARGET_BRIEFING_BYTES,
      maximumToolResultBytes: TARGET_TOOL_RESULT_BYTES,
    },
  };
  const normalizedTranscript = {
    tuple,
    promptResult: promptObservation.result.structured,
    promptFinal: promptObservation.finalValue,
    briefingResult: briefingObservation.result.structured,
    briefingFinal: briefingObservation.finalValue,
  };
  const evidence = {
    schemaVersion: 1,
    ...tuple,
    observed: {
      briefingBytes: TARGET_BRIEFING_BYTES,
      toolResultBytes: TARGET_TOOL_RESULT_BYTES,
      structuredTextDeepEqual: true,
      modelObservedBothTailMarkers: true,
      normalizedTranscriptDigest: sha256(canonicalJson(normalizedTranscript)),
    },
    verifiedAt: new Date().toISOString(),
  };

  process.stdout.write(`${JSON.stringify(evidence, undefined, 2)}\n`);
};

if (host === "openclaw" || host === "hermes") {
  const module = await import("./verify-real-host-capacity-fixture.mjs");
  writeSync(process.stdout.fd, `${JSON.stringify(module.realHostVerification, undefined, 2)}\n`);
} else {
  await runLegacyVerification();
}
