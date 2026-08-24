import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const electron = vi.hoisted(() => ({
  showOpenDialog: vi.fn(),
}));

vi.mock("electron", () => ({
  dialog: { showOpenDialog: electron.showOpenDialog },
  BrowserWindow: class {},
}));

import { IPC_CHANNELS, registerIpcHandlers } from "../src/main/ipc";

type Handler = (event: unknown, payload?: unknown) => Promise<unknown>;

function setup() {
  const handlers = new Map<string, Handler>();
  const ipcMain = {
    handle: vi.fn((channel: string, handler: Handler) => handlers.set(channel, handler)),
    removeHandler: vi.fn((channel: string) => handlers.delete(channel)),
  };
  const send = vi.fn();
  const window = { webContents: { send } };
  const dependencies = {
    ipcMain: ipcMain as never,
    window: () => window as never,
    platform: vi.fn(async () => ({ desktop: true as const } as never)),
    lifecycleStatus: vi.fn(() => ({ state: "ready" as const, recoveryMode: false })),
    applySettings: vi.fn(async () => ({ ok: true, revision: 2 })),
    runProbe: vi.fn(async () => ({ status: "ok" as const })),
  };
  const dispose = registerIpcHandlers(dependencies);
  const trustedEvent = {
    senderFrame: { url: "bento://app/settings" },
    sender: { getURL: () => "bento://app/settings" },
  };
  return { dependencies, dispose, handlers, ipcMain, send, trustedEvent };
}

describe("main IPC handlers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("registers and removes only the allowlisted command channels", () => {
    const { dispose, handlers, ipcMain } = setup();
    expect([...handlers.keys()].sort()).toEqual(
      [
        IPC_CHANNELS.platform,
        IPC_CHANNELS.lifecycleStatus,
        IPC_CHANNELS.pickDirectory,
        IPC_CHANNELS.pickFile,
        IPC_CHANNELS.settingsApply,
        IPC_CHANNELS.settingsProbe,
      ].sort(),
    );
    dispose();
    expect(ipcMain.removeHandler).toHaveBeenCalledTimes(6);
    expect(handlers.size).toBe(0);
  });

  it.each([
    "https://attacker.example",
    "bento://evil/settings",
    "file:///tmp/index.html",
    "javascript:alert(1)",
    "not a url",
  ])("rejects an untrusted sender before invoking dependencies: %s", async (url) => {
    const { dependencies, handlers } = setup();
    const handler = handlers.get(IPC_CHANNELS.platform)!;
    await expect(handler({ senderFrame: { url }, sender: { getURL: () => url } })).rejects.toThrow();
    expect(dependencies.platform).not.toHaveBeenCalled();
  });

  it("validates settings before application and sends progress on a fixed outbound channel", async () => {
    const { dependencies, handlers, send, trustedEvent } = setup();
    const handler = handlers.get(IPC_CHANNELS.settingsApply)!;
    const payload = { revision: 1, values: { ocr_enabled: false }, secrets: {} };
    await expect(handler(trustedEvent, payload)).resolves.toEqual({ ok: true, revision: 2 });
    const progress = dependencies.applySettings.mock.calls[0]?.[1];
    progress?.({ phase: "validating", status: "started" });
    expect(send).toHaveBeenCalledWith(IPC_CHANNELS.settingsProgress, {
      phase: "validating",
      status: "started",
    });

    await expect(handler(trustedEvent, { ...payload, arbitraryCommand: "open-shell" })).rejects.toThrow(TypeError);
    expect(dependencies.applySettings).toHaveBeenCalledTimes(1);
  });

  it("uses native pickers with fixed capabilities and rejects an unsafe returned path", async () => {
    const { handlers, trustedEvent } = setup();
    const safePath = path.join(path.parse(process.cwd()).root, "tmp", "bento-data");
    electron.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [safePath] });
    await expect(handlers.get(IPC_CHANNELS.pickDirectory)!(trustedEvent, { title: "Datos" })).resolves.toEqual({
      canceled: false,
      path: safePath,
    });
    expect(electron.showOpenDialog).toHaveBeenCalledWith(expect.anything(), {
      title: "Datos",
      properties: ["openDirectory", "createDirectory", "promptToCreate"],
    });

    electron.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [path.parse(process.cwd()).root] });
    await expect(handlers.get(IPC_CHANNELS.pickFile)!(trustedEvent, {})).rejects.toThrow(/root/i);
  });

  it("never forwards hostile probes", async () => {
    const { dependencies, handlers, trustedEvent } = setup();
    const handler = handlers.get(IPC_CHANNELS.settingsProbe)!;
    await expect(handler(trustedEvent, { kind: "telegram", secrets: { token: "new-secret" } })).resolves.toEqual({
      status: "ok",
    });
    await expect(handler(trustedEvent, { kind: "shell", command: "whoami" })).rejects.toThrow(TypeError);
    expect(dependencies.runProbe).toHaveBeenCalledTimes(1);
  });
});
