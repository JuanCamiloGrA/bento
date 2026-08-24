import type { FieldIssue, RestartPlan } from "./settings";

export type DesktopPlatform = {
  arch: string;
  desktop: true;
  platform: "darwin" | "linux" | "win32";
  recoveryMode: boolean;
  secureStorage: "available" | "unavailable";
  version: string;
};

export type SecretOperation =
  | { operation: "clear" }
  | { operation: "set"; value: string }
  | { operation: "unchanged" };

export type DesktopApplyResult = {
  errors?: FieldIssue[];
  ok: boolean;
  restartPlan?: RestartPlan | { affectedKeys: string[]; mode: string; services: string[] };
  revision: number;
  rolledBack?: boolean;
};

export type ApplyProgress = {
  message?: string;
  phase: "validating" | "persisting" | "secrets" | "restarting" | "verifying" | "rolling-back" | "complete";
  status: "failed" | "ok" | "started";
};

export type BentoDesktopBridge = {
  lifecycle: {
    onStatus(listener: (status: { recoveryMode: boolean; state: string }) => void): () => void;
    status(): Promise<{ recoveryMode: boolean; state: string }>;
  };
  pickDirectory(options?: { title?: string }): Promise<{ canceled: boolean; path?: string }>;
  pickFile(options?: { filters?: { extensions: string[]; name: string }[]; title?: string }): Promise<{ canceled: boolean; path?: string }>;
  platform(): Promise<DesktopPlatform>;
  settings: {
    apply(input: { dataMigration?: "copy" | "use-empty"; revision: number; runProbes?: boolean; secrets: Record<string, SecretOperation>; values: Record<string, unknown> }): Promise<DesktopApplyResult>;
    onProgress(listener: (event: ApplyProgress) => void): () => void;
    probe(input: { kind: "ffmpeg" | "model-file" | "ocr" | "telegram" | "writable-directory"; path?: string; secrets?: Record<string, string> }): Promise<{ code?: string; status: "failed" | "ok" }>;
  };
};

declare global {
  interface Window {
    bento?: BentoDesktopBridge;
  }
}

export function desktopBridge(): BentoDesktopBridge | null {
  return typeof window !== "undefined" && window.bento ? window.bento : null;
}

export async function detectDesktopPlatform(): Promise<DesktopPlatform | null> {
  const bridge = desktopBridge();
  if (!bridge) return null;
  try {
    return await bridge.platform();
  } catch {
    return null;
  }
}
