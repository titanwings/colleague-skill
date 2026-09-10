import { createCodexHostBinding } from "@distilly/bindings";
import { contentDigestSchema } from "@distilly/protocol";
import { openPreviewMcpApplication } from "../lib/preview.js";

const root = process.env.DISTILLY_PREVIEW_ROOT;
const assetsDir = process.env.DISTILLY_PREVIEW_PANEL_ASSETS;
if (!root || !assetsDir) {
  throw new Error("Preview stdio fixture requires root and Panel assets.");
}

const application = await openPreviewMcpApplication({
  root,
  binding: createCodexHostBinding({
    homeDirectory: root,
    executablePath: "/usr/bin/false",
    forms: { ask: () => Promise.reject(new Error("Forms are not used by this fixture.")) },
    provider: { load: () => Promise.reject(new Error("Preflight is owned by the caller.")) },
    release: {
      releaseVersion: "0.1.0-preview.1",
      wireMajor: 3,
      canonicalSkillDigest: contentDigestSchema.parse(`sha256_${"a".repeat(64)}`),
    },
    now: () => new Date("2026-08-31T20:00:00.000Z"),
  }),
  hostContext: { sessionId: "built-preview-stdio", environment: "ci" },
  capacity: {
    // This fixture feeds the protocol's own 4 MiB wire limit, so it declares the byte
    // budget explicitly and derives the token figure instead of reusing the byte count.
    maximumInputTokens: 1_048_576,
    maximumInputBytes: 4_194_304,
    maximumToolResultBytes: 4_194_304,
    source: "sdk_explicit",
  },
  panel: { assetsDir },
});

try {
  await application.runStdio();
} finally {
  await application.close();
}
