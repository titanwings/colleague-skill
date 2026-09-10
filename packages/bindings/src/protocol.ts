import type {
  CapturedPrivateTranscript,
  ExportOptions,
  ExportRef,
  HostEnvironment,
  HostName,
  HostPreflight,
  InstallOptions,
  InstallRef,
  PrivateUiCaptureActionResult,
  PrivateUiCaptureAuthorization,
  PrivateUiCaptureGrantStatus,
  PrivateUiCaptureRefused,
  PrivateUiCaptureScope,
  Profile,
  SubjectId,
  Unsubscribe,
  VersionId,
} from "@distilly/protocol";

/** Trusted host session details supplied by production composition. */
export interface HostContext {
  readonly sessionId: string;
  readonly workingDirectory?: string;
  readonly environment: HostEnvironment;
}

/** One rendered profile prompt selected for a host subrun. */
export interface Injection {
  readonly subjectId: SubjectId;
  readonly versionId: VersionId;
  readonly prompt: string;
}

/** Provider-neutral request that a full host binding may wrap for a subrun. */
export interface HostSpawnRequest {
  readonly instructions: readonly string[];
  readonly input: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

/** Full host projection and subrun contract implemented by later product slices. */
export interface HostInjector {
  readonly host: HostName;
  injectSubrun(injection: Injection, request: HostSpawnRequest): HostSpawnRequest;
  install(profile: Profile, options: InstallOptions): Promise<InstallRef>;
  uninstall(ref: InstallRef): Promise<void>;
  exportIdentity(profile: Profile, options: ExportOptions): Promise<ExportRef>;
}

/** Trusted runtime and source paths required by a production plugin installer. */
export interface InstallContext {
  readonly launcherPath: string;
  readonly pluginSourcePath: string;
  readonly runtimeVersion: string;
}

/** Exact paths owned by one completed host plugin installation. */
export interface PluginInstallResult {
  readonly host: HostName;
  readonly manifestPath: string;
  readonly installedPaths: readonly string[];
  readonly restartRequired: boolean;
}

/** Sanitized health report from a production host binding. */
export interface HostDoctorResult {
  readonly host: HostName;
  readonly installed: boolean;
  readonly launcherReachable: boolean;
  readonly wireCompatible: boolean;
  readonly warnings: readonly string[];
  readonly remediation?: string;
}

/** Capability-only host entry delivered before production composition exists. */
export interface HostCapabilityBinding {
  readonly kind: "capability";
  readonly host: HostName;
  preflight(context: HostContext): Promise<HostPreflight>;
}

/** Complete host entry that owns lifecycle and creates all host-specific ports. */
export interface HostBinding {
  readonly kind: "full";
  readonly host: HostName;
  preflight(context: HostContext): Promise<HostPreflight>;
  createInjector(context: HostContext): HostInjector;
  createFormRenderer(context: HostContext): HostFormRenderer;
  installPlugin(context: InstallContext): Promise<PluginInstallResult>;
  uninstallPlugin(context: InstallContext): Promise<void>;
  doctor(context: HostContext): Promise<HostDoctorResult>;
  createPrivateUiCaptureController?(context: HostContext): PrivateUiCaptureController;
}

export type HostRegistryBinding = HostCapabilityBinding | HostBinding;

/** Injected trusted boundary that obtains one host preflight payload. */
export interface HostPreflightProvider {
  load(context: HostContext): Promise<unknown>;
}

/** Release tuple against which trusted preflight evidence is matched. */
export interface HostCapabilityBindingOptions {
  readonly provider: HostPreflightProvider;
  readonly release: {
    readonly releaseVersion: string;
    readonly wireMajor: 3;
    readonly canonicalSkillDigest: `sha256_${string}`;
  };
}

/** Trusted outer presenter used by a concrete host form renderer. */
export interface HostFormPresenter {
  ask<T extends HostQuestion>(input: {
    readonly host: HostName;
    readonly context: HostContext;
    readonly question: T;
  }): Promise<HostAnswer<T>>;
}

/** Result of one host CLI command owned by a full binding. */
export interface HostCommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** Injectable command boundary used only for host-supported plugin lifecycle commands. */
export interface HostCommandRunner {
  run(input: {
    readonly executablePath: string;
    readonly args: readonly string[];
    readonly homeDirectory: string;
    /** Environment values owned by the host binding (never secret values). */
    readonly environment?: Readonly<Record<string, string | undefined>>;
    /** Optional bounded stdin for a host command with an explicit confirmation prompt. */
    readonly input?: string;
  }): Promise<HostCommandResult>;
}

/** Shared trusted inputs required to construct a production full binding. */
export interface FullHostBindingOptions extends HostCapabilityBindingOptions {
  readonly homeDirectory: string;
  readonly forms: HostFormPresenter;
  readonly now?: () => Date;
}

/** Codex full-binding inputs, including the checked host executable. */
export interface CodexHostBindingOptions extends FullHostBindingOptions {
  readonly executablePath: string;
  readonly commandRunner?: HostCommandRunner;
}

/** Claude Code full-binding inputs. */
export type ClaudeCodeHostBindingOptions = FullHostBindingOptions;

/** OpenClaw full-binding inputs for its Claude-compatible bundle surface. */
export interface OpenClawHostBindingOptions extends FullHostBindingOptions {
  readonly executablePath: string;
  readonly commandRunner?: HostCommandRunner;
}

/** Hermes full-binding inputs for its Skill plus stdio-MCP compatibility surface. */
export interface HermesHostBindingOptions extends FullHostBindingOptions {
  readonly executablePath: string;
  readonly commandRunner?: HostCommandRunner;
}

/**
 * DeepSeek Harness full-binding inputs.
 *
 * DSH composes one profile from bundle layers plus a user patch layer, so the
 * binding owns a dedicated profile under `$DSH_HOME/profiles/<name>` and mounts
 * the MCP client there by absolute path instead of mutating a shared profile.
 */
export interface DshHostBindingOptions extends FullHostBindingOptions {
  readonly executablePath: string;
  readonly profilesRoot?: string;
  readonly mcpClientPackagePath?: string;
  readonly profileName?: string;
  readonly commandRunner?: HostCommandRunner;
}

export type HostQuestion =
  | { readonly kind: "short_text"; readonly prompt: string }
  | { readonly kind: "explicit_consent"; readonly prompt: string }
  | {
      readonly kind: "single_choice";
      readonly prompt: string;
      readonly options: readonly string[];
    }
  | { readonly kind: "playable_preview"; readonly path: string };

export type HostAnswer<T extends HostQuestion> = T["kind"] extends "explicit_consent"
  ? { readonly confirmed: boolean }
  : T["kind"] extends "single_choice"
    ? { readonly selectedIndex: number }
    : { readonly text: string };

/** Native host form boundary for a closed semantic question. */
export interface HostFormRenderer {
  readonly host: HostName;
  ask<T extends HostQuestion>(question: T): Promise<HostAnswer<T>>;
}

/** Non-serializable, one-shot authorization handle owned by a trusted host. */
export interface PrivateUiCaptureGrantHandle {
  readonly authorization: PrivateUiCaptureAuthorization;
  bindOnce(): Promise<boolean>;
  status(): Promise<PrivateUiCaptureGrantStatus>;
  watch(listener: (status: PrivateUiCaptureGrantStatus) => void): Unsubscribe;
  release(): Promise<void>;
}

export type PrivateUiCaptureAuthorizationResult =
  | {
      readonly kind: "granted";
      readonly grant: PrivateUiCaptureGrantHandle;
    }
  | PrivateUiCaptureRefused;

/** Runtime-owned action invoked only through a trusted user-gesture surface. */
export interface PrivateUiCaptureActionPort {
  run(input: {
    readonly scope: PrivateUiCaptureScope;
    readonly invocationId: string;
  }): Promise<PrivateUiCaptureActionResult>;
}

/** Disposable native host action registration. */
export interface HostActionRegistration {
  readonly id: string;
  readonly userGestureRequired: true;
  close(): Promise<void>;
}

/** Trusted host UI controller for authorization, guarded capture, and action registration. */
export interface PrivateUiCaptureController {
  authorize(scope: PrivateUiCaptureScope): Promise<PrivateUiCaptureAuthorizationResult>;
  capture(
    scope: PrivateUiCaptureScope,
    grant: PrivateUiCaptureGrantHandle,
  ): Promise<CapturedPrivateTranscript>;
  registerAction(port: PrivateUiCaptureActionPort): Promise<HostActionRegistration>;
}
