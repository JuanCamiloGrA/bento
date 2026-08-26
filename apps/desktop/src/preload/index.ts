import { contextBridge, ipcRenderer } from "electron";
import {
  BentoDesktopBridge,
  DirectoryPickerRequest,
  FilePickerRequest,
  IPC_CHANNELS,
  LifecycleStatus,
  PlatformMetadata,
  ProbeRequest,
  ProbeResult,
  ProgressEvent,
  SettingsApplyRequest,
  SettingsApplyResult,
  UpdateInstallResult,
  UpdateState,
} from "../shared/contracts";

interface NarrowIpcRenderer {
  invoke(channel: string, payload?: unknown): Promise<unknown>;
  on(channel: string, listener: (_event: unknown, payload: unknown) => void): void;
  removeListener(channel: string, listener: (_event: unknown, payload: unknown) => void): void;
}

export function createBentoBridge(ipc: NarrowIpcRenderer): BentoDesktopBridge {
  const subscribe = <T>(channel: string, listener: (payload: T) => void): (() => void) => {
    const guarded = (_event: unknown, payload: unknown): void => listener(payload as T);
    ipc.on(channel, guarded);
    return () => ipc.removeListener(channel, guarded);
  };

  return Object.freeze({
    platform: () => ipc.invoke(IPC_CHANNELS.platform) as Promise<PlatformMetadata>,
    pickDirectory: (request: DirectoryPickerRequest = {}) =>
      ipc.invoke(IPC_CHANNELS.pickDirectory, request) as Promise<{ canceled: boolean; path?: string }>,
    pickFile: (request: FilePickerRequest = {}) =>
      ipc.invoke(IPC_CHANNELS.pickFile, request) as Promise<{ canceled: boolean; path?: string }>,
    settings: Object.freeze({
      apply: (request: SettingsApplyRequest) =>
        ipc.invoke(IPC_CHANNELS.settingsApply, request) as Promise<SettingsApplyResult>,
      probe: (request: ProbeRequest) => ipc.invoke(IPC_CHANNELS.settingsProbe, request) as Promise<ProbeResult>,
      onProgress: (listener: (event: ProgressEvent) => void) =>
        subscribe(IPC_CHANNELS.settingsProgress, listener),
    }),
    lifecycle: Object.freeze({
      status: () => ipc.invoke(IPC_CHANNELS.lifecycleStatus) as Promise<LifecycleStatus>,
      onStatus: (listener: (status: LifecycleStatus) => void) =>
        subscribe(IPC_CHANNELS.lifecycleChanged, listener),
    }),
    updates: Object.freeze({
      getState: () => ipc.invoke(IPC_CHANNELS.updatesState) as Promise<UpdateState>,
      check: () => ipc.invoke(IPC_CHANNELS.updatesCheck) as Promise<UpdateState>,
      download: () => ipc.invoke(IPC_CHANNELS.updatesDownload) as Promise<UpdateState>,
      install: () => ipc.invoke(IPC_CHANNELS.updatesInstall) as Promise<UpdateInstallResult>,
      onState: (listener: (state: UpdateState) => void) =>
        subscribe(IPC_CHANNELS.updatesChanged, listener),
    }),
  });
}

contextBridge.exposeInMainWorld("bento", createBentoBridge(ipcRenderer));

declare global {
  interface Window {
    bento: BentoDesktopBridge;
  }
}
