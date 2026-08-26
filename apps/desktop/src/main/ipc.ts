import { BrowserWindow, dialog, IpcMain, IpcMainInvokeEvent, OpenDialogOptions } from "electron";
import {
  BENTO_ORIGIN,
  IPC_CHANNELS,
  LifecycleStatus,
  PlatformMetadata,
  ProbeResult,
  ProgressEvent,
  SettingsApplyResult,
  UpdateInstallResult,
  UpdateState,
} from "../shared/contracts";
import {
  validateDirectoryPicker,
  validateFilePicker,
  validateProbe,
  validateSafePath,
  validateSettingsApply,
} from "./validation";

export interface IpcDependencies {
  ipcMain: IpcMain;
  window: () => BrowserWindow | null;
  platform: () => Promise<PlatformMetadata>;
  lifecycleStatus: () => LifecycleStatus;
  applySettings: (request: ReturnType<typeof validateSettingsApply>, progress: (event: ProgressEvent) => void) => Promise<SettingsApplyResult>;
  runProbe: (request: ReturnType<typeof validateProbe>) => Promise<ProbeResult>;
  updates: {
    state: UpdateState;
    check(): Promise<UpdateState>;
    download(): Promise<UpdateState>;
    install(): Promise<UpdateInstallResult>;
  };
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const url = event.senderFrame?.url ?? event.sender.getURL();
  const parsed = new URL(url);
  if (parsed.protocol !== "bento:" || parsed.host !== "app") throw new Error("Untrusted IPC sender");
}

export function registerIpcHandlers(dependencies: IpcDependencies): () => void {
  const handle = (channel: string, listener: (event: IpcMainInvokeEvent, payload: unknown) => unknown): void => {
    dependencies.ipcMain.handle(channel, async (event, payload) => {
      assertTrustedSender(event);
      return listener(event, payload);
    });
  };

  handle(IPC_CHANNELS.platform, () => dependencies.platform());
  handle(IPC_CHANNELS.lifecycleStatus, () => dependencies.lifecycleStatus());
  handle(IPC_CHANNELS.pickDirectory, async (_event, payload) => {
    const request = validateDirectoryPicker(payload);
    const options: OpenDialogOptions = {
      title: request.title,
      properties: ["openDirectory", "createDirectory", "promptToCreate"],
    };
    const owner = dependencies.window();
    const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length !== 1) return { canceled: true };
    return { canceled: false, path: validateSafePath(result.filePaths[0]) };
  });
  handle(IPC_CHANNELS.pickFile, async (_event, payload) => {
    const request = validateFilePicker(payload);
    const options: OpenDialogOptions = {
      title: request.title,
      filters: request.filters,
      properties: ["openFile"],
    };
    const owner = dependencies.window();
    const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length !== 1) return { canceled: true };
    return { canceled: false, path: validateSafePath(result.filePaths[0]) };
  });
  handle(IPC_CHANNELS.settingsApply, async (_event, payload) => {
    const request = validateSettingsApply(payload);
    return dependencies.applySettings(request, (progress) => {
      dependencies.window()?.webContents.send(IPC_CHANNELS.settingsProgress, progress);
    });
  });
  handle(IPC_CHANNELS.settingsProbe, (_event, payload) => dependencies.runProbe(validateProbe(payload)));
  handle(IPC_CHANNELS.updatesState, (_event, payload) => { assertNoPayload(payload); return dependencies.updates.state; });
  handle(IPC_CHANNELS.updatesCheck, (_event, payload) => { assertNoPayload(payload); return dependencies.updates.check(); });
  handle(IPC_CHANNELS.updatesDownload, (_event, payload) => { assertNoPayload(payload); return dependencies.updates.download(); });
  handle(IPC_CHANNELS.updatesInstall, (_event, payload) => { assertNoPayload(payload); return dependencies.updates.install(); });

  return () => {
    for (const channel of [
      IPC_CHANNELS.platform,
      IPC_CHANNELS.lifecycleStatus,
      IPC_CHANNELS.pickDirectory,
      IPC_CHANNELS.pickFile,
      IPC_CHANNELS.settingsApply,
      IPC_CHANNELS.settingsProbe,
      IPC_CHANNELS.updatesState,
      IPC_CHANNELS.updatesCheck,
      IPC_CHANNELS.updatesDownload,
      IPC_CHANNELS.updatesInstall,
    ]) dependencies.ipcMain.removeHandler(channel);
  };
}

function assertNoPayload(payload: unknown): void {
  if (payload !== undefined) throw new TypeError("This IPC command does not accept a payload");
}

export { IPC_CHANNELS, BENTO_ORIGIN };
