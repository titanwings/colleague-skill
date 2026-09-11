import { isAbsolute, join, resolve } from "node:path";

import { BUILTIN_HOSTS } from "@distilly/protocol";

import { createHostFormRenderer } from "../full/form-renderer.js";
import { createHostInjector } from "../full/injector.js";
import { doctorPluginTree, installPluginTree, uninstallPluginTree } from "../full/plugin-tree.js";
import type {
  ClaudeCodeHostBindingOptions,
  HostBinding,
  HostContext,
  InstallContext,
} from "../protocol.js";
import { createClaudeCodeCapabilityBinding } from "./capability.js";

const PLATFORM_MANIFEST = ".claude-plugin/plugin.json";

const validateOptions = (options: ClaudeCodeHostBindingOptions): void => {
  if (!isAbsolute(options.homeDirectory)) {
    throw new TypeError("Claude Code full binding homeDirectory must be absolute.");
  }
  if (typeof options.forms?.ask !== "function") {
    throw new TypeError("Claude Code full binding requires a trusted form presenter.");
  }
  if (options.now !== undefined && typeof options.now !== "function") {
    throw new TypeError("Claude Code full binding now must be a function when provided.");
  }
};

/**
 * Creates the complete local Claude Code binding used by Preview composition.
 *
 * @param options - Trusted release, home, presenter, and clock inputs.
 * @returns Full Claude Code binding with real lifecycle and projection behavior.
 */
export const createClaudeCodeHostBinding = (options: ClaudeCodeHostBindingOptions): HostBinding => {
  validateOptions(options);
  const capability = createClaudeCodeCapabilityBinding({
    provider: options.provider,
    release: options.release,
  });
  const host = BUILTIN_HOSTS.claudeCode;
  const homeDirectory = resolve(options.homeDirectory);
  const pluginRoot = join(homeDirectory, ".claude", "skills", "distilly");
  const now = options.now ?? (() => new Date());

  return Object.freeze({
    kind: "full" as const,
    host,
    preflight: (context: HostContext) => capability.preflight(context),
    createInjector: () => createHostInjector(host, homeDirectory, now),
    createFormRenderer: (context: HostContext) =>
      createHostFormRenderer(host, context, options.forms),
    installPlugin: (context: InstallContext) =>
      installPluginTree(context, options.release.releaseVersion, {
        host,
        trustedRoot: homeDirectory,
        pluginRoot,
        transactionRoot: join(homeDirectory, ".distilly", "host-install"),
        platformManifestPath: PLATFORM_MANIFEST,
        expectedSkillDigest: options.release.canonicalSkillDigest,
        repairDamaged: options.repairDamagedHost === true,
        mcpShape: (launcherPath) => ({
          mcpServers: {
            distilly: { command: launcherPath, args: ["mcp", "--host", host] },
          },
        }),
      }),
    uninstallPlugin: () => uninstallPluginTree(pluginRoot, host, homeDirectory),
    doctor: () => doctorPluginTree(pluginRoot, host, options.release.releaseVersion),
  });
};
