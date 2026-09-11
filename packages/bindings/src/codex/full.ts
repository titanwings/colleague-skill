import { lstat } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

import { BUILTIN_HOSTS, DistillyError } from "@distilly/protocol";

import { createHostFormRenderer } from "../full/form-renderer.js";
import { createHostInjector } from "../full/injector.js";
import { defaultHostCommandRunner } from "../full/command-runner.js";
import {
  doctorPluginTree,
  installPluginTree,
  uninstallPluginTree,
  verifyPluginTree,
} from "../full/plugin-tree.js";
import type {
  CodexHostBindingOptions,
  HostBinding,
  HostContext,
  InstallContext,
} from "../protocol.js";
import { createCodexCapabilityBinding } from "./capability.js";
import {
  installMarketplaceEntry,
  readMarketplaceName,
  restoreMarketplace,
  uninstallMarketplaceEntry,
} from "./marketplace.js";

const PLATFORM_MANIFEST = ".codex-plugin/plugin.json";

const commandFailed = (action: "install" | "uninstall"): DistillyError =>
  new DistillyError({
    code: "internal_error",
    message: `Codex could not ${action} the Distilly plugin.`,
    retryable: false,
  });

const validateOptions = (options: CodexHostBindingOptions): void => {
  if (!isAbsolute(options.homeDirectory)) {
    throw new TypeError("Codex full binding homeDirectory must be absolute.");
  }
  if (!isAbsolute(options.executablePath)) {
    throw new TypeError("Codex full binding executablePath must be absolute.");
  }
  if (typeof options.forms?.ask !== "function") {
    throw new TypeError("Codex full binding requires a trusted form presenter.");
  }
  if (options.now !== undefined && typeof options.now !== "function") {
    throw new TypeError("Codex full binding now must be a function when provided.");
  }
  if (options.commandRunner !== undefined && typeof options.commandRunner.run !== "function") {
    throw new TypeError("Codex full binding commandRunner must provide run.");
  }
};

/**
 * Creates the complete local Codex binding used by Preview composition.
 *
 * @param options - Trusted release, home, executable, presenter, and command boundary.
 * @returns Full Codex binding with real lifecycle and projection behavior.
 */
export const createCodexHostBinding = (options: CodexHostBindingOptions): HostBinding => {
  validateOptions(options);
  const capability = createCodexCapabilityBinding({
    provider: options.provider,
    release: options.release,
  });
  const host = BUILTIN_HOSTS.codex;
  const homeDirectory = resolve(options.homeDirectory);
  const pluginRoot = join(homeDirectory, "plugins", "distilly");
  const runner = options.commandRunner ?? defaultHostCommandRunner;
  const now = options.now ?? (() => new Date());

  return Object.freeze({
    kind: "full" as const,
    host,
    preflight: (context: HostContext) => capability.preflight(context),
    createInjector: () => createHostInjector(host, homeDirectory, now),
    createFormRenderer: (context: HostContext) =>
      createHostFormRenderer(host, context, options.forms),
    installPlugin: (context: InstallContext) =>
      installPluginTree(
        context,
        options.release.releaseVersion,
        {
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
        },
        async () => {
          let marketplace: Awaited<ReturnType<typeof installMarketplaceEntry>> | undefined;
          try {
            marketplace = await installMarketplaceEntry(homeDirectory);
            const command = await runner.run({
              executablePath: options.executablePath,
              args: ["plugin", "add", `distilly@${marketplace.name}`, "--json"],
              homeDirectory,
            });
            if (command.exitCode !== 0) throw commandFailed("install");
          } catch (error) {
            if (marketplace !== undefined) await restoreMarketplace(marketplace);
            throw error;
          }
        },
      ),
    uninstallPlugin: async () => {
      const pluginMetadata = await lstat(pluginRoot).catch((error: unknown) => {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw error;
      });
      if (pluginMetadata !== undefined && !(await verifyPluginTree(pluginRoot, host))) return;
      const marketplaceName = await readMarketplaceName(homeDirectory);
      if (marketplaceName !== undefined) {
        const command = await runner.run({
          executablePath: options.executablePath,
          args: ["plugin", "remove", `distilly@${marketplaceName}`, "--json"],
          homeDirectory,
        });
        if (command.exitCode !== 0) throw commandFailed("uninstall");
      }
      await uninstallPluginTree(pluginRoot, host, homeDirectory);
      await uninstallMarketplaceEntry(homeDirectory);
    },
    doctor: () => doctorPluginTree(pluginRoot, host, options.release.releaseVersion),
  });
};
