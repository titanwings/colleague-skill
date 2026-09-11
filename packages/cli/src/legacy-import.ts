import { lstat, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * One person directory written by the legacy Skill release.
 *
 * The older release kept a person as a folder of Markdown plus a `meta.json` descriptor under
 * a parent such as `skills/colleague`. Migration has to read that layout without asking the
 * user to restructure anything, and without guessing when a folder is not a person at all.
 */
export interface LegacyPerson {
  readonly directory: string;
  /** Directory name, used when the descriptor carries no usable name. */
  readonly slug: string;
  readonly displayName: string;
  readonly aliases: readonly string[];
  /** True when `meta.json` existed and parsed; false when the folder only had Markdown. */
  readonly described: boolean;
  /** Fields the descriptor carried that are not part of the subject itself. */
  readonly descriptorNotes: readonly string[];
}

/** How deep the legacy search descends below the given directory. */
const LEGACY_SEARCH_DEPTH = 4;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asText = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

/**
 * Reports whether one path is a directory that can be read without following a symlink.
 *
 * @param path - Candidate path.
 * @returns True for a real directory.
 */
const isDirectory = async (path: string): Promise<boolean> => {
  try {
    const metadata = await lstat(path);
    return metadata.isDirectory() && !metadata.isSymbolicLink();
  } catch {
    return false;
  }
};

/**
 * Reports whether a directory looks like one legacy person rather than a parent of people.
 *
 * @param directory - Candidate directory.
 * @returns True when the directory carries the legacy person files.
 */
export const isLegacyPersonDirectory = async (directory: string): Promise<boolean> => {
  const hasFile = async (name: string): Promise<boolean> => {
    try {
      const metadata = await lstat(join(directory, name));
      return metadata.isFile() && !metadata.isSymbolicLink();
    } catch {
      return false;
    }
  };
  // persona.md or work.md are written only for a person, so they settle it immediately.
  if ((await hasFile("persona.md")) || (await hasFile("work.md"))) return true;
  if (!(await hasFile("meta.json"))) return false;
  // A directory that holds only a descriptor but also contains person directories is a
  // category, not a person: treating it as a person would swallow everyone below it. The search
  // has to match the walker's depth, or an intermediate folder hides the people under it.
  return !(await containsPersonDirectory(directory, 1));
};

/**
 * Reports whether any person directory exists below one directory, within the search depth.
 *
 * @param directory - Directory to search.
 * @param depth - Current depth below the original path.
 * @returns True when a person directory was found.
 */
const containsPersonDirectory = async (directory: string, depth: number): Promise<boolean> => {
  if (depth > LEGACY_SEARCH_DEPTH) return false;
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name.startsWith(".")) continue;
    const child = join(directory, entry.name);
    if (await isLegacyPersonDirectory(child)) return true;
    if (await containsPersonDirectory(child, depth + 1)) return true;
  }
  return false;
};

/**
 * Reads one legacy person directory, using `meta.json` for the name and aliases.
 *
 * A descriptor that cannot be read or parsed is reported instead of failing the migration: the
 * Markdown beside it is still the person's evidence, and the directory name is still a name.
 *
 * @param directory - Legacy person directory.
 * @returns The person, or undefined when the directory is not a person directory.
 */
export const readLegacyPerson = async (directory: string): Promise<LegacyPerson | undefined> => {
  if (!(await isLegacyPersonDirectory(directory))) return undefined;
  const slug = directory.slice(directory.lastIndexOf("/") + 1);
  let meta: Record<string, unknown> | undefined;
  let descriptorNotes: string[] = [];
  try {
    const parsed: unknown = JSON.parse(await readFile(join(directory, "meta.json"), "utf8"));
    if (!isRecord(parsed)) throw new Error("meta.json is not an object");
    meta = parsed;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      meta = undefined;
    } else {
      descriptorNotes = [
        `meta.json could not be read (${error instanceof Error ? error.message : "unknown error"}); the directory name was used instead.`,
      ];
    }
  }
  const displayName = asText(meta?.["name"]) ?? slug;
  const aliases: string[] = [];
  const slugAlias = asText(meta?.["slug"]);
  if (slugAlias !== undefined && slugAlias !== displayName) aliases.push(slugAlias);
  if (Array.isArray(meta?.["aliases"])) {
    for (const alias of meta["aliases"]) {
      const text = asText(alias);
      if (text !== undefined && text !== displayName && !aliases.includes(text)) aliases.push(text);
    }
  }
  if (meta !== undefined) {
    const profile = isRecord(meta["profile"]) ? meta["profile"] : undefined;
    const role = profile === undefined ? undefined : asText(profile["role"]);
    const company = profile === undefined ? undefined : asText(profile["company"]);
    const parts = [role, company].filter((part): part is string => part !== undefined);
    if (parts.length > 0) {
      descriptorNotes.push(`The legacy descriptor recorded ${parts.join(" at ")}.`);
    }
    if (asText(meta["impression"]) !== undefined) {
      descriptorNotes.push("The legacy descriptor carried an impression, which stays evidence.");
    }
  }
  return {
    directory,
    slug,
    displayName,
    aliases,
    described: meta !== undefined,
    descriptorNotes,
  };
};

/**
 * Lists the legacy people under one path.
 *
 * A path that is itself a person directory is one person; any other path is treated as the
 * legacy parent directory, and each child directory that looks like a person is one person, in
 * deterministic name order.
 *
 * @param path - Legacy person directory or a parent of them.
 * @returns Every person found, in a stable order.
 */
export const listLegacyPeople = async (path: string): Promise<readonly LegacyPerson[]> => {
  if (!(await isDirectory(path))) {
    throw new Error("The import path must be an existing directory.");
  }
  const direct = await readLegacyPerson(path);
  if (direct !== undefined) return [direct];
  // The legacy release nests one category level between the skills root and each person
  // (`skills/colleague/<person>`), so the search descends until it finds people rather than
  // assuming a fixed depth, and never descends into a person directory.
  const people: LegacyPerson[] = [];
  const walk = async (directory: string, depth: number): Promise<void> => {
    if (depth > LEGACY_SEARCH_DEPTH) return;
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries.sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    )) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name.startsWith(".")) continue;
      const child = join(directory, entry.name);
      const person = await readLegacyPerson(child);
      if (person !== undefined) {
        people.push(person);
        continue;
      }
      await walk(child, depth + 1);
    }
  };
  await walk(path, 1);
  return people;
};
