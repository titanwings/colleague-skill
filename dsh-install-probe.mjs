// Installs the DSH binding into an isolated DSH home and reports what it wrote.
// usage: node dsh-install-probe.mjs <dshHome>
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const dshHome = process.argv[2];
if (dshHome === undefined) throw new Error("usage: node dsh-install-probe.mjs <dshHome>");

const { createDshHostBinding } = await import("./packages/bindings/lib/dsh/full.js");
const manifest = JSON.parse(await readFile("./plugins/release-manifest.json", "utf8"));

// The DSH executable used for verification: the real installation under external/dsh.
const dshExecutable =
  "/Users/zhoutianyi/Documents/dsh/external/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js";

const launcherPath = join(dshHome, ".distilly", "bin", "distilly");
await mkdir(join(dshHome, ".distilly", "bin"), { recursive: true });
await writeFile(launcherPath, "#!/bin/sh\nexit 0\n", { mode: 0o755 });

const binding = createDshHostBinding({
  homeDirectory: dshHome,
  executablePath: dshExecutable,
  forms: { ask: async () => ({ text: "x" }) },
  provider: {
    load: async (context) => ({
      ok: true,
      capabilities: {
        webResearch: "available",
        localFileRead: "available",
        vision: "unknown",
        documentTextExtraction: "unknown",
        imageOcr: "unknown",
        audioTranscription: "unknown",
        videoCaptions: "unknown",
        privateUiCapture: "unavailable",
        windowScopedCapture: "unknown",
        captureDataPolicy: "unknown",
        structuredToolCalls: true,
        lifecycleHooks: [],
        subruns: true,
        subrunsInheritMcp: true,
        opensLoopbackUrls: true,
      },
      capacity: {
        maximumInputTokens: 65536,
        maximumToolResultBytes: 65536,
        source: "host_handshake",
      },
      evidence: {
        kind: "host_handshake",
        host: "dsh",
        hostVersion: "v0.1.5-rc.1",
        environment: context.environment,
        releaseVersion: manifest.releaseVersion,
        wireMajor: 3,
        canonicalSkillDigest: manifest.canonicalSkill.digest,
      },
      warnings: [],
    }),
  },
  release: {
    releaseVersion: manifest.releaseVersion,
    wireMajor: 3,
    canonicalSkillDigest: manifest.canonicalSkill.digest,
  },
});

const result = await binding.installPlugin({
  launcherPath,
  pluginSourcePath: join(process.cwd(), "plugins", "dsh"),
  runtimeVersion: manifest.releaseVersion,
});

const profileRoot = join(dshHome, "profiles", "distilly");
const patch = await readFile(join(profileRoot, "cordis.patch.yml"), "utf8");
const composition = await readFile(join(profileRoot, "distilly-profile.json"), "utf8");
const skill = await readFile(join(dshHome, "skills", "distilly", "SKILL.md"));
const health = await binding.doctor({ sessionId: "dsh-probe", environment: "cli" });

console.log(
  JSON.stringify(
    {
      install: {
        host: result.host,
        restartRequired: result.restartRequired,
        manifestPath: result.manifestPath,
        installedPaths: result.installedPaths,
      },
      patch,
      composition: JSON.parse(composition),
      userSkillDigest: `sha256_${createHash("sha256").update(skill).digest("hex")}`,
      doctor: health,
    },
    null,
    2,
  ),
);
