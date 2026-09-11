// Release consistency check: one release tuple, verified against every artifact that names it.
//
// A release can go out with a capacity fixture that still names the previous version, a plugin
// tree whose digest no longer matches the manifest, or no changelog entry at all. Each of those
// breaks host setup for real users, so they are checked here instead of at first use.
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

// The repository root is overridable so the consistency rules can be tested against a small
// mutated copy instead of the real tree.
const REPOSITORY_ROOT =
  process.env.DISTILLY_RELEASE_ROOT ?? fileURLToPath(new URL("../", import.meta.url));
const problems = [];
const notes = [];

const fail = (message) => problems.push(message);
const note = (message) => notes.push(message);

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
};

const canonicalJson = (value) => JSON.stringify(canonicalize(value));
const sha256 = (bytes) => `sha256_${createHash("sha256").update(bytes).digest("hex")}`;

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

/** Collects every regular file under one root, keyed by POSIX relative path. */
const walkRegularFiles = async (root) => {
  const files = new Map();
  const walk = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        fail(`plugin source contains a symbolic link: ${relative(REPOSITORY_ROOT, path)}`);
        continue;
      }
      if (entry.isDirectory()) {
        await walk(path);
        continue;
      }
      if (!entry.isFile()) {
        fail(`plugin source contains a non-regular entry: ${relative(REPOSITORY_ROOT, path)}`);
        continue;
      }
      files.set(relative(root, path).split(sep).join("/"), await readFile(path));
    }
  };
  await walk(root);
  return files;
};

const skillTreeDigest = (files) => {
  const skillPrefix = "skills/distilly/";
  const records = [...files.entries()]
    .filter(([path]) => path.startsWith(skillPrefix))
    .map(([path, bytes]) => ({
      path: path.slice(skillPrefix.length),
      contentDigest: sha256(bytes),
    }))
    .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  return sha256(Buffer.from(`canonical-skill-tree-v1\0${canonicalJson(records)}`, "utf8"));
};

const manifestPath = join(REPOSITORY_ROOT, "plugins", "release-manifest.json");
const manifest = await readJson(manifestPath);
const releaseVersion = manifest.releaseVersion;
if (typeof releaseVersion !== "string" || releaseVersion.length === 0) {
  fail("the release manifest has no releaseVersion");
}

// 1. The canonical Skill digest recorded in the manifest must match the shared Skill tree.
const canonicalRoot = join(REPOSITORY_ROOT, manifest.canonicalSkill.root);
const canonicalFiles = await walkRegularFiles(canonicalRoot);
const computedCanonical = skillTreeDigest(
  new Map([...canonicalFiles].map(([path, bytes]) => [`skills/distilly/${path}`, bytes])),
);
if (computedCanonical !== manifest.canonicalSkill.digest) {
  fail(
    `plugins/release-manifest.json canonicalSkill.digest is ${manifest.canonicalSkill.digest} but the tree hashes to ${computedCanonical}`,
  );
}
for (const file of manifest.canonicalSkill.files ?? []) {
  const bytes = canonicalFiles.get(file.path);
  if (bytes === undefined) {
    fail(`the canonical Skill tree is missing ${file.path}`);
    continue;
  }
  if (sha256(bytes) !== file.contentDigest) {
    fail(`the canonical Skill file ${file.path} no longer matches its recorded digest`);
  }
}

// 2. Every recorded host target must still produce the recorded digests from its own tree.
for (const target of manifest.targets ?? []) {
  const root = join(REPOSITORY_ROOT, target.pluginRoot);
  const files = await walkRegularFiles(root);
  const digest = skillTreeDigest(files);
  if (digest !== target.skillDigest) {
    fail(
      `${target.host}: plugins/release-manifest.json skillDigest is ${target.skillDigest} but ${target.pluginRoot} hashes to ${digest}`,
    );
  }
  if (digest !== manifest.canonicalSkill.digest) {
    fail(`${target.host}: the plugin Skill tree differs from the canonical Skill tree`);
  }
  const manifestBytes = files.get(
    relative(root, join(REPOSITORY_ROOT, target.pluginManifestPath)).split(sep).join("/"),
  );
  if (manifestBytes === undefined) {
    fail(`${target.host}: ${target.pluginManifestPath} is missing`);
    continue;
  }
  const parsed = JSON.parse(Buffer.from(manifestBytes).toString("utf8"));
  if (parsed.version !== releaseVersion) {
    fail(
      `${target.host}: ${target.pluginManifestPath} declares version ${parsed.version}, not ${releaseVersion}`,
    );
  }
  if (sha256(manifestBytes) !== target.pluginManifestDigest) {
    fail(`${target.host}: ${target.pluginManifestPath} no longer matches its recorded digest`);
  }
}

// 3. Every capacity fixture must name this release and this Skill digest.
const evidenceRoot = join(REPOSITORY_ROOT, "packages", "cli", "src", "evidence", "host-capacity");
const fixtureNames = (await readdir(evidenceRoot).catch(() => [])).filter((name) =>
  name.endsWith(".json"),
);
if (fixtureNames.length === 0) fail("no host capacity fixture is recorded");
for (const name of fixtureNames.sort()) {
  const fixture = await readJson(join(evidenceRoot, name));
  if (fixture.releaseVersion !== releaseVersion) {
    fail(
      `${name} was measured for release ${fixture.releaseVersion}, not ${releaseVersion}; re-measure it or remove it`,
    );
  }
  if (fixture.canonicalSkillDigest !== manifest.canonicalSkill.digest) {
    fail(`${name} records a different canonical Skill digest than this release`);
  }
  if (fixture.boundKind !== undefined && fixture.capacity?.boundKind !== "verified_lower_bound") {
    fail(`${name} must declare boundKind "verified_lower_bound"`);
  }
  if ((fixture.capacity?.estimatedInputTokens ?? 0) >= (fixture.capacity?.verifiedBriefingBytes ?? 0)) {
    fail(`${name} claims a token budget that is not derived from its measured bytes`);
  }
}
note(`${fixtureNames.length} capacity fixture(s) verified against ${releaseVersion}`);

// 4. Every package that is meant to be published with this release carries its version.
//    Private workspace packages stay at 0.0.0 by design and are only checked for a version field.
const packageRoots = (await readdir(join(REPOSITORY_ROOT, "packages"), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
let published = 0;
for (const name of packageRoots) {
  const path = join(REPOSITORY_ROOT, "packages", name, "package.json");
  const descriptor = await readJson(path);
  if (descriptor.private === true) continue;
  published += 1;
  if (descriptor.version === "0.0.0") {
    note(`packages/${name} is published but still at 0.0.0`);
    continue;
  }
  if (descriptor.version !== releaseVersion) {
    fail(`packages/${name}/package.json declares version ${descriptor.version}, not ${releaseVersion}`);
  }
}
note(`${published} publishable package(s) checked`);

// 5. The changelog must describe this release.
const changelog = await readFile(join(REPOSITORY_ROOT, "CHANGELOG.md"), "utf8").catch(() => "");
if (!changelog.includes(releaseVersion)) {
  fail(`CHANGELOG.md has no section for ${releaseVersion}`);
}

// 6. The plugin manifest the DSH profile layer publishes must exist.
if (!(await stat(join(REPOSITORY_ROOT, "plugins", "dsh", "package.json")).catch(() => undefined))) {
  fail("plugins/dsh/package.json is missing, so DSH has no platform manifest");
}

for (const summary of notes) console.log(`ok: ${summary}`);
if (problems.length > 0) {
  console.error(`release check failed for ${releaseVersion}:`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}
console.log(`release check passed for ${releaseVersion} (${manifest.targets?.length ?? 0} host target(s))`);
