/**
 * Minimal argument parser for the Distilly CLI (zero dependencies).
 *
 * Mirrors the subset of Python's argparse behaviour the ported tools relied on:
 * `--flag value`, `--flag=value`, boolean switches, repeated options and
 * positionals. Unknown options are a hard error — the CLI never guesses.
 */

/** Raised for user-facing argument problems (exit code 1). */
export class ArgError extends Error {
  constructor(message) {
    super(message);
    this.name = "ArgError";
  }
}

/**
 * @typedef {object} OptionSpec
 * @property {'boolean'|'string'} type
 * @property {string} [alias]        short flag without dashes, e.g. `o`
 * @property {string} [help]
 * @property {boolean} [multiple]    collect repeats into an array
 * @property {string} [value]        metavar shown in help
 */

function optionNames(longName, spec) {
  const names = [`--${longName}`];
  if (spec.alias) names.push(`-${spec.alias}`);
  return names;
}

/**
 * @param {string[]} argv
 * @param {Record<string, OptionSpec>} spec
 * @returns {{flags: Record<string, any>, positionals: string[]}}
 */
export function parseArgs(argv, spec = {}) {
  const byName = new Map();
  for (const [longName, option] of Object.entries(spec)) {
    for (const name of optionNames(longName, option)) byName.set(name, longName);
  }

  const flags = {};
  for (const [longName, option] of Object.entries(spec)) {
    if (option.multiple) flags[longName] = [];
    else if (option.type === "boolean") flags[longName] = false;
    else flags[longName] = undefined;
  }

  const positionals = [];
  let index = 0;
  while (index < argv.length) {
    const arg = argv[index];
    if (arg === "--") {
      positionals.push(...argv.slice(index + 1));
      break;
    }
    if (arg.startsWith("-") && arg !== "-") {
      const equals = arg.indexOf("=");
      const name = equals === -1 ? arg : arg.slice(0, equals);
      const inlineValue = equals === -1 ? undefined : arg.slice(equals + 1);
      const longName = byName.get(name);
      if (!longName) throw new ArgError(`unrecognized argument: ${name}`);
      const option = spec[longName];
      if (option.type === "boolean") {
        if (inlineValue !== undefined) {
          throw new ArgError(`${name} does not take a value`);
        }
        flags[longName] = true;
      } else {
        const value = inlineValue !== undefined ? inlineValue : argv[index + 1];
        if (value === undefined || (inlineValue === undefined && value.startsWith("-") && value !== "-")) {
          throw new ArgError(`${name} requires a value`);
        }
        if (inlineValue === undefined) index += 1;
        if (option.multiple) flags[longName].push(value);
        else flags[longName] = value;
      }
      index += 1;
      continue;
    }
    positionals.push(arg);
    index += 1;
  }

  return { flags, positionals };
}

/** True when the argument list asks for help. */
export function wantsHelp(argv) {
  return argv.includes("--help") || argv.includes("-h");
}

/** Render `<name> <metavar>` fragments for a usage line. */
export function usageFragment(spec = {}) {
  const parts = [];
  for (const [longName, option] of Object.entries(spec)) {
    if (option.hidden) continue;
    const bare = option.alias ? `-${option.alias}, --${longName}` : `--${longName}`;
    parts.push(option.type === "boolean" ? `[${bare}]` : `[${bare} <${option.value ?? "value"}>]`);
  }
  return parts.join(" ");
}
