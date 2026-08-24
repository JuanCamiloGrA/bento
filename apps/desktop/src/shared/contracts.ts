export const BENTO_ORIGIN = "bento://app" as const;

export const IPC_CHANNELS = {
  platform: "bento:platform",
  pickDirectory: "bento:pick-directory",
  pickFile: "bento:pick-file",
  settingsApply: "bento:settings-apply",
  settingsProbe: "bento:settings-probe",
  settingsProgress: "bento:settings-progress",
  lifecycleStatus: "bento:lifecycle-status",
  lifecycleChanged: "bento:lifecycle-changed",
} as const;

export type ApplyPhase =
  | "validating"
  | "persisting"
  | "secrets"
  | "restarting"
  | "verifying"
  | "rolling-back"
  | "complete";

export interface ProgressEvent {
  phase: ApplyPhase;
  status: "started" | "ok" | "failed";
  message?: string;
}

export type LifecycleState = "starting" | "ready" | "restarting" | "recovery" | "stopping";

export interface LifecycleStatus {
  state: LifecycleState;
  recoveryMode: boolean;
}

export interface PlatformMetadata {
  desktop: true;
  platform: NodeJS.Platform;
  arch: string;
  version: string;
  secureStorage: "available" | "unavailable";
  recoveryMode: boolean;
}

export interface PickerResult {
  canceled: boolean;
  path?: string;
}

export interface FilePickerRequest {
  title?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

export interface DirectoryPickerRequest {
  title?: string;
}

export type SecretMutation =
  | { operation: "set"; value: string }
  | { operation: "clear" }
  | { operation: "unchanged" };

export interface SettingsApplyRequest {
  revision: number;
  values: Record<string, unknown>;
  secrets: Record<string, SecretMutation>;
  runProbes?: boolean;
  dataMigration?: "copy" | "use-empty";
}

export interface RestartPlan {
  mode: string;
  services: string[];
  affectedKeys: string[];
}

export interface SettingsApplyResult {
  ok: boolean;
  revision: number;
  restartPlan?: RestartPlan;
  rolledBack?: boolean;
  errors?: Array<{ key: string; code: string; message: string }>;
}

export type ProbeKind = "writable-directory" | "model-file" | "ffmpeg" | "ocr" | "telegram";

export interface ProbeRequest {
  kind: ProbeKind;
  path?: string;
  secrets?: Record<string, string>;
}

export interface ProbeResult {
  status: "ok" | "failed";
  code?: string;
}

export interface BentoDesktopBridge {
  platform(): Promise<PlatformMetadata>;
  pickDirectory(request?: DirectoryPickerRequest): Promise<PickerResult>;
  pickFile(request?: FilePickerRequest): Promise<PickerResult>;
  settings: {
    apply(request: SettingsApplyRequest): Promise<SettingsApplyResult>;
    probe(request: ProbeRequest): Promise<ProbeResult>;
    onProgress(listener: (event: ProgressEvent) => void): () => void;
  };
  lifecycle: {
    status(): Promise<LifecycleStatus>;
    onStatus(listener: (status: LifecycleStatus) => void): () => void;
  };
}
