import { createHash, randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  rmdir,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import {
  DistillyError,
  contentDigestSchema,
  installRefSchema,
  isoDateTimeSchema,
  profileSchema,
  type ContentDigest,
  type ExportOptions,
  type ExportRef,
  type HostName,
  type InstallOptions,
  type InstallRef,
  type Profile,
} from "@distilly/protocol";

import type { HostInjector, HostSpawnRequest, Injection } from "../protocol.js";

const INSTALL_MANIFEST = ".distilly-install.json";
const SKILL_FILE = "SKILL.md";
/**
 * Registration marker Claude Code needs before it adopts a skills-directory plugin.
 *
 * The host's own `claude plugin init` writes exactly this file beside `SKILL.md`; a bare
 * `SKILL.md` directory is not registered (verified against the real binary), so a person Skill
 * installed for Claude Code carries one too. The version is the profile's immutable version
 * prefix, which keeps every install a distinct valid prerelease without inventing a release.
 */
const CLAUDE_CODE_PLUGIN_FILE = ".claude-plugin/plugin.json";

interface PersonInstallManifest {
  readonly schemaVersion: 1;
  readonly install: InstallRef;
  /** Every file this install owns, verified byte for byte; SKILL.md is always present. */
  readonly files: readonly {
    readonly path: string;
    readonly contentDigest: ContentDigest;
  }[];
}

/** Paths an owned person Skill may contain besides SKILL.md. */
const ALLOWED_PERSON_FILES: ReadonlySet<string> = new Set([CLAUDE_CODE_PLUGIN_FILE]);

/**
 * Builds the host registration marker for one person Skill, when the host needs one.
 *
 * @param host - Host the Skill is installed for.
 * @param name - Skill directory name the host will register.
 * @param profile - Profile being installed.
 * @returns The file to write, or undefined when this host registers a bare SKILL.md.
 */
const personRegistrationFile = (
  host: HostName,
  name: string,
  profile: Profile,
): { readonly path: string; readonly bytes: Uint8Array } | undefined => {
  if (host !== "claude-code") return undefined;
  const version = profile.versionId.replace(/^version_/u, "").slice(0, 12);
  return {
    path: CLAUDE_CODE_PLUGIN_FILE,
    bytes: Buffer.from(
      `${canonicalJson({
        $schema: "https://anthropic.com/claude-code/plugin.schema.json",
        name,
        version: `0.0.0-${version}`,
        description: `Use ${profile.displayName}'s evidence-grounded Distilly Person Profile when the user explicitly selects it.`,
        skills: ["./"],
      })}\n`,
      "utf8",
    ),
  };
};

const invalid = (message: string, fieldPath?: string): DistillyError =>
  new DistillyError({
    code: "invalid_input",
    message,
    retryable: false,
    ...(fieldPath === undefined ? {} : { fieldPath }),
  });

const modified = (): DistillyError =>
  new DistillyError({
    code: "storage_corrupt",
    message: "The installed person Skill was modified outside Distilly.",
    retryable: false,
    remediation: "Back up the modified Skill before removing or reinstalling it.",
  });

const digest = (bytes: Uint8Array | string): ContentDigest =>
  contentDigestSchema.parse(`sha256_${createHash("sha256").update(bytes).digest("hex")}`);

const compareUtf8 = (left: string, right: string): number =>
  Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => compareUtf8(left, right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
};

const canonicalJson = (value: unknown): string => JSON.stringify(canonicalize(value));

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort(compareUtf8);
  const expected = [...keys].sort(compareUtf8);
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const isInside = (root: string, candidate: string): boolean => {
  const path = relative(root, candidate);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== "..");
};

const slug = (value: string): string => {
  const normalized = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 36);
  return normalized.length === 0 ? "person" : normalized;
};

const skillName = (profile: Profile): string => {
  const suffix = createHash("sha256").update(profile.subjectId).digest("hex").slice(0, 10);
  return `distilly-${slug(profile.displayName)}-${suffix}`;
};

const renderPersonSkill = (profile: Profile, name: string): string => {
  const metadata = canonicalJson({
    displayName: profile.displayName,
    maturity: profile.quality.maturity,
    subjectId: profile.subjectId,
    versionId: profile.versionId,
  });
  const rendered = profile.rendered.endsWith("\n") ? profile.rendered : `${profile.rendered}\n`;
  return (
    "---\n" +
    `name: ${name}\n` +
    "description: Use one evidence-grounded Distilly Person Profile when the user explicitly selects it.\n" +
    "---\n\n" +
    "# Distilly Person Profile\n\n" +
    "Use this Profile only when the user explicitly asks to work with this person's perspective.\n\n" +
    "## Subject metadata\n\n" +
    `    ${metadata}\n\n` +
    rendered +
    "\n## Behavior constraints\n\n" +
    "- This is an evidence-bounded simulation, not the person.\n" +
    "- Do not invent facts that are not recorded.\n" +
    "- Preserve recorded boundaries and explicitly acknowledge contested claims.\n"
  );
};

const defaultSkillsRoot = (host: HostName, homeDirectory: string): string => {
  if (host === "codex") return join(homeDirectory, ".codex", "skills");
  if (host === "claude-code") return join(homeDirectory, ".claude", "skills");
  if (host === "openclaw") return join(homeDirectory, ".openclaw", "skills");
  if (host === "hermes") return join(homeDirectory, ".hermes", "skills");
  // DSH scans its own home's skills root, so a person Skill belongs beside the integration.
  if (host === "dsh") return join(homeDirectory, "skills");
  throw invalid(`No default Skill directory is defined for host ${host}.`);
};

const validateVersion = (
  profile: Profile,
  options: { readonly versionId?: Profile["versionId"] },
): void => {
  if (options.versionId !== undefined && options.versionId !== profile.versionId) {
    throw invalid(
      "The requested version does not match the supplied immutable Profile.",
      "versionId",
    );
  }
};

const personInstallId = (install: Omit<InstallRef, "id" | "installedAt">): string =>
  `install-${createHash("sha256")
    .update(
      `${install.host}\0${install.subjectId}\0${install.versionId}\0${install.path}\0${install.contentDigest}`,
    )
    .digest("hex")
    .slice(0, 24)}`;

const hasSameInstallIdentity = (
  install: InstallRef,
  expected: Omit<InstallRef, "id" | "installedAt">,
): boolean =>
  install.id === personInstallId(expected) &&
  install.host === expected.host &&
  install.subjectId === expected.subjectId &&
  install.versionId === expected.versionId &&
  install.path === expected.path &&
  install.contentDigest === expected.contentDigest;

const parseManifest = (bytes: Uint8Array): PersonInstallManifest => {
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    throw modified();
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw modified();
  const manifest = value as Record<string, unknown>;
  const parsedInstall = installRefSchema.safeParse(manifest.install);
  const rawFiles = manifest.files;
  if (
    !hasExactKeys(manifest, ["schemaVersion", "install", "files"]) ||
    manifest.schemaVersion !== 1 ||
    !parsedInstall.success ||
    !Array.isArray(rawFiles) ||
    rawFiles.length === 0
  ) {
    throw modified();
  }
  const files: { path: string; contentDigest: ContentDigest }[] = [];
  const paths = new Set<string>();
  for (const entry of rawFiles) {
    if (
      entry === null ||
      typeof entry !== "object" ||
      Array.isArray(entry) ||
      !hasExactKeys(entry as Record<string, unknown>, ["path", "contentDigest"])
    ) {
      throw modified();
    }
    const path = (entry as { path: unknown }).path;
    if (
      typeof path !== "string" ||
      (path !== SKILL_FILE && !ALLOWED_PERSON_FILES.has(path)) ||
      paths.has(path) ||
      !contentDigestSchema.safeParse((entry as { contentDigest: unknown }).contentDigest).success
    ) {
      throw modified();
    }
    paths.add(path);
    files.push({
      path,
      contentDigest: (entry as { contentDigest: ContentDigest }).contentDigest,
    });
  }
  const skill = files.find((file) => file.path === SKILL_FILE);
  if (skill === undefined || parsedInstall.data.contentDigest !== skill.contentDigest) {
    throw modified();
  }
  return { schemaVersion: 1, install: parsedInstall.data, files };
};

const readRegularFile = async (path: string): Promise<Uint8Array> => {
  try {
    const metadata = await lstat(path);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw modified();
    return Uint8Array.from(await readFile(path));
  } catch {
    throw modified();
  }
};

const readVerifiedInstall = async (
  root: string,
  expectedHost: HostName,
): Promise<PersonInstallManifest> => {
  try {
    const metadata = await lstat(root);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw modified();
  } catch {
    throw modified();
  }
  const manifestPath = resolve(root, INSTALL_MANIFEST);
  const skillPath = resolve(root, SKILL_FILE);
  if (!isInside(root, manifestPath) || !isInside(root, skillPath)) throw modified();
  const manifest = parseManifest(await readRegularFile(manifestPath));
  const install = manifest.install;
  if (
    install.host !== expectedHost ||
    !isAbsolute(install.path) ||
    resolve(install.path) !== root ||
    install.id !==
      personInstallId({
        host: install.host,
        subjectId: install.subjectId,
        versionId: install.versionId,
        path: install.path,
        contentDigest: install.contentDigest,
      })
  ) {
    throw modified();
  }
  for (const file of manifest.files) {
    const path = resolve(root, file.path);
    if (!isInside(root, path)) throw modified();
    if (digest(await readRegularFile(path)) !== file.contentDigest) throw modified();
  }
  return manifest;
};

const installProfile = async (
  host: HostName,
  homeDirectory: string,
  now: () => Date,
  profileValue: Profile,
  options: InstallOptions,
): Promise<InstallRef> => {
  const profile = profileSchema.parse(profileValue) as Profile;
  validateVersion(profile, options);
  const name = skillName(profile);
  const root =
    options.destination === undefined
      ? join(defaultSkillsRoot(host, homeDirectory), name)
      : resolveDestination(options.destination);
  const skill = renderPersonSkill(profile, name);
  const contentDigest = digest(skill);
  const identity = {
    host,
    subjectId: profile.subjectId,
    versionId: profile.versionId,
    path: root,
    contentDigest,
  } as const;

  // A profile can be re-distilled after its Skill was installed. Distilly updates the install
  // it already owns for this subject in place rather than refusing or leaving a second copy
  // behind, and a display-name change therefore keeps the host's Skill path stable.
  const owned =
    options.destination === undefined
      ? await findOwnedInstall(host, homeDirectory, profile.subjectId)
      : undefined;
  const destination = owned?.path ?? root;
  const existing = await lstat(destination).catch(() => undefined);
  if (existing !== undefined) {
    if (!existing.isDirectory() || existing.isSymbolicLink()) {
      throw invalid("The person Skill destination already exists and is not a regular directory.");
    }
    const current = await readVerifiedInstall(destination, host);
    if (hasSameInstallIdentity(current.install, identity)) return current.install;
    if (current.install.subjectId !== profile.subjectId) {
      throw invalid(
        "The person Skill destination already contains another or modified installation.",
      );
    }
    const replaced: InstallRef = {
      id: personInstallId({ ...identity, path: destination }),
      ...identity,
      path: destination,
      installedAt: isoDateTimeSchema.parse(now().toISOString()),
    };
    const replacementRegistration = personRegistrationFile(host, name, profile);
    await replaceInstall(
      destination,
      homeDirectory,
      host,
      skill,
      {
        schemaVersion: 1,
        install: replaced,
        files: [
          { path: SKILL_FILE, contentDigest },
          ...(replacementRegistration === undefined
            ? []
            : [
                {
                  path: replacementRegistration.path,
                  contentDigest: digest(replacementRegistration.bytes),
                },
              ]),
        ],
      },
      replacementRegistration,
    );
    return replaced;
  }

  const install: InstallRef = {
    id: personInstallId(identity),
    ...identity,
    installedAt: isoDateTimeSchema.parse(now().toISOString()),
  };
  const registration = personRegistrationFile(host, name, profile);
  const manifest: PersonInstallManifest = {
    schemaVersion: 1,
    install,
    files: [
      { path: SKILL_FILE, contentDigest },
      ...(registration === undefined
        ? []
        : [{ path: registration.path, contentDigest: digest(registration.bytes) }]),
    ],
  };

  await mkdir(dirname(root), { recursive: true });
  const transactionRoot = join(homeDirectory, ".distilly", "host-install");
  await mkdir(transactionRoot, { recursive: true });
  const staging = join(transactionRoot, `${host}-person-${randomUUID()}`);
  try {
    await mkdir(staging);
    await writeFile(join(staging, SKILL_FILE), skill, { mode: 0o644 });
    if (registration !== undefined) {
      await mkdir(dirname(join(staging, registration.path)), { recursive: true });
      await writeFile(join(staging, registration.path), registration.bytes, { mode: 0o644 });
    }
    await writeFile(join(staging, INSTALL_MANIFEST), `${canonicalJson(manifest)}\n`, {
      mode: 0o600,
    });
    await rename(staging, root);
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
  return install;
};

/**
 * Replaces one verified person Skill with a new version without a window where neither exists.
 *
 * The old Skill is moved aside first and restored if the new one cannot be moved into place, so
 * a failure leaves the host with exactly the Skill it had before. Only a verified install is
 * ever replaced: modified or foreign content is never deleted by Distilly.
 *
 * @param destination - Absolute Skill directory to replace.
 * @param homeDirectory - Host home owning the transaction directory.
 * @param host - Host the Skill belongs to.
 * @param skill - New SKILL.md content.
 * @param manifest - New install manifest.
 * @param registration - Host registration marker to write beside SKILL.md, when the host needs one.
 * @param registration.path - Root-relative path of the marker.
 * @param registration.bytes - Exact marker bytes.
 */
const replaceInstall = async (
  destination: string,
  homeDirectory: string,
  host: HostName,
  skill: string,
  manifest: PersonInstallManifest,
  registration?: { readonly path: string; readonly bytes: Uint8Array },
): Promise<void> => {
  const transactionRoot = join(homeDirectory, ".distilly", "host-install");
  await mkdir(transactionRoot, { recursive: true });
  const staging = join(transactionRoot, `${host}-person-${randomUUID()}`);
  const backup = join(transactionRoot, `${host}-person-previous-${randomUUID()}`);
  await mkdir(staging);
  await writeFile(join(staging, SKILL_FILE), skill, { mode: 0o644 });
  if (registration !== undefined) {
    await mkdir(dirname(join(staging, registration.path)), { recursive: true });
    await writeFile(join(staging, registration.path), registration.bytes, { mode: 0o644 });
  }
  await writeFile(join(staging, INSTALL_MANIFEST), `${canonicalJson(manifest)}\n`, { mode: 0o600 });
  let movedAside = false;
  try {
    await rename(destination, backup);
    movedAside = true;
    await rename(staging, destination);
  } catch (error) {
    if (movedAside) await rename(backup, destination).catch(() => undefined);
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
  await rm(backup, { recursive: true, force: true });
};

/**
 * Finds the person Skill Distilly already installed for one subject under a host's skills root.
 *
 * @param host - Host whose skills root is scanned.
 * @param homeDirectory - Host home directory.
 * @param subjectId - Subject the Skill must belong to.
 * @returns The verified install, or undefined when no readable install matches.
 */
const findOwnedInstall = async (
  host: HostName,
  homeDirectory: string,
  subjectId: string,
): Promise<InstallRef | undefined> => {
  const installs = await listPersonInstalls(host, homeDirectory);
  const match = installs.find(
    (entry): entry is Extract<PersonInstallSummary, { verified: true }> =>
      entry.verified && entry.install.subjectId === subjectId,
  );
  return match?.install;
};

/** One entry under a host's skills root that looks like a Distilly person Skill. */
export type PersonInstallSummary =
  | { readonly verified: true; readonly install: InstallRef }
  | {
      readonly verified: false;
      readonly path: string;
      readonly host: HostName;
      /** Why the directory could not be verified as a Distilly install. */
      readonly reason: string;
    };

/**
 * Lists every person Skill installed for one host, verified ones first.
 *
 * A directory that cannot be verified is reported instead of hidden: it is either a modified
 * Distilly Skill (which Distilly refuses to overwrite or delete) or another tool's Skill that
 * happens to sit in the same root.
 *
 * @param host - Host whose skills root is scanned.
 * @param homeDirectory - Host home directory.
 * @returns Deterministically ordered install summaries.
 */
export const listPersonInstalls = async (
  host: HostName,
  homeDirectory: string,
): Promise<readonly PersonInstallSummary[]> => {
  const root = defaultSkillsRoot(host, homeDirectory);
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const summaries: PersonInstallSummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    // Claude Code keeps the Distilly integration Skill itself in the same skills root. It is
    // not a person Skill, so listing it as an unverifiable one would only confuse the report.
    if (entry.name === "distilly") continue;
    const path = join(root, entry.name);
    try {
      const manifest = await readVerifiedInstall(path, host);
      summaries.push({ verified: true, install: manifest.install });
    } catch (error) {
      summaries.push({
        verified: false,
        path,
        host,
        reason: error instanceof Error ? error.message : "The install could not be verified.",
      });
    }
  }
  return summaries.sort((left, right) => {
    const leftPath = left.verified ? left.install.path : left.path;
    const rightPath = right.verified ? right.install.path : right.path;
    return compareUtf8(leftPath, rightPath);
  });
};

const resolveDestination = (destination: string): string => {
  if (!isAbsolute(destination)) {
    throw invalid("A person Skill destination must be an absolute path.", "destination");
  }
  return resolve(destination);
};

const uninstallProfile = async (host: HostName, ref: InstallRef): Promise<void> => {
  const parsedRef = installRefSchema.safeParse(ref);
  if (!parsedRef.success) throw invalid("The installation reference is invalid.", "ref");
  if (parsedRef.data.host !== host) {
    throw invalid("The installation belongs to another host.", "ref.host");
  }
  const root = resolveDestination(parsedRef.data.path);
  const existing = await lstat(root).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  });
  if (existing === undefined) return;
  const manifest = await readVerifiedInstall(root, host);
  if (canonicalJson(manifest.install) !== canonicalJson(parsedRef.data)) throw modified();
  for (const file of manifest.files) {
    const path = resolve(root, file.path);
    if (!isInside(root, path)) throw modified();
    await unlink(path);
  }
  await unlink(join(root, INSTALL_MANIFEST));
  // A registration marker sits in its own directory, so clear the directories it leaves behind.
  const directories = new Set<string>();
  for (const file of manifest.files) {
    let directory = dirname(resolve(root, file.path));
    while (isInside(root, directory) && directory !== root) {
      directories.add(directory);
      directory = dirname(directory);
    }
  }
  for (const directory of [...directories].sort((left, right) => right.length - left.length)) {
    await rmdir(directory).catch((error: unknown) => {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOTEMPTY" && code !== "ENOENT") throw error;
    });
  }
  await rmdir(root).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code !== "ENOTEMPTY") throw error;
  });
};

const exportProfile = async (
  host: HostName,
  profileValue: Profile,
  options: ExportOptions,
): Promise<ExportRef> => {
  const profile = profileSchema.parse(profileValue) as Profile;
  validateVersion(profile, options);
  const destination = resolveDestination(options.destination);
  const content = renderPersonSkill(profile, skillName(profile));
  const contentDigest = digest(content);
  await mkdir(dirname(destination), { recursive: true });
  const existing = await lstat(destination).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  });
  if (existing !== undefined) {
    if (!existing.isFile() || existing.isSymbolicLink()) {
      throw invalid("The export destination is not a regular file.", "destination");
    }
    if (digest(await readFile(destination)) === contentDigest) {
      return {
        host,
        subjectId: profile.subjectId,
        versionId: profile.versionId,
        path: destination,
        contentDigest,
      };
    }
  }
  if (!options.overwrite) {
    await writeFile(destination, content, { mode: 0o600, flag: "wx" }).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw invalid("The export destination already exists.", "destination");
      }
      throw error;
    });
  } else {
    await writeFile(destination, content, { mode: 0o600 });
  }
  return {
    host,
    subjectId: profile.subjectId,
    versionId: profile.versionId,
    path: destination,
    contentDigest,
  };
};

/**
 * Creates one real host injector without touching global instruction files.
 *
 * @param host - Host that owns the projection.
 * @param homeDirectory - Explicit user home used for default Skill paths.
 * @param now - Trusted installation clock.
 * @returns Concrete prompt and person-projection injector.
 */
export const createHostInjector = (
  host: HostName,
  homeDirectory: string,
  now: () => Date,
): HostInjector =>
  Object.freeze({
    host,
    injectSubrun: (injection: Injection, request: HostSpawnRequest): HostSpawnRequest => ({
      ...request,
      instructions: [...request.instructions, injection.prompt],
      metadata: {
        ...request.metadata,
        "distilly.subjectId": injection.subjectId,
        "distilly.versionId": injection.versionId,
      },
    }),
    install: (profile: Profile, options: InstallOptions) =>
      installProfile(host, homeDirectory, now, profile, options),
    uninstall: (ref: InstallRef) => uninstallProfile(host, ref),
    exportIdentity: (profile: Profile, options: ExportOptions) =>
      exportProfile(host, profile, options),
  });
