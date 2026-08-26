import { beforeEach, describe, expect, it, vi } from "vitest";

const electron = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
}));

vi.mock("electron", () => ({
  contextBridge: { exposeInMainWorld: electron.exposeInMainWorld },
  ipcRenderer: {
    invoke: electron.invoke,
    on: electron.on,
    removeListener: electron.removeListener,
  },
}));

import { createBentoBridge } from "../src/preload/index";
import { IPC_CHANNELS } from "../src/shared/contracts";

describe("preload allowlisted bridge", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exposes only the documented narrow surface", () => {
    const bridge = createBentoBridge(electron);
    expect(Object.keys(bridge).sort()).toEqual(["lifecycle", "pickDirectory", "pickFile", "platform", "settings", "updates"]);
    expect(Object.keys(bridge.settings).sort()).toEqual(["apply", "onProgress", "probe"]);
    expect(Object.keys(bridge.lifecycle).sort()).toEqual(["onStatus", "status"]);
    expect(Object.keys(bridge.updates).sort()).toEqual(["check", "download", "getState", "install", "onState"]);
    expect(Object.isFrozen(bridge)).toBe(true);
    expect(Object.isFrozen(bridge.settings)).toBe(true);
    expect(Object.isFrozen(bridge.lifecycle)).toBe(true);
    expect(bridge).not.toHaveProperty("ipcRenderer");
    expect(bridge).not.toHaveProperty("fs");
    expect(bridge).not.toHaveProperty("shell");
    expect(bridge).not.toHaveProperty("process");
  });

  it("maps every command to a fixed channel", async () => {
    electron.invoke.mockResolvedValue(undefined);
    const bridge = createBentoBridge(electron);
    const apply = { revision: 1, values: {}, secrets: {} };
    const probe = { kind: "ffmpeg" as const };

    await bridge.platform();
    await bridge.pickDirectory();
    await bridge.pickFile({ title: "Modelo" });
    await bridge.settings.apply(apply);
    await bridge.settings.probe(probe);
    await bridge.lifecycle.status();
    await bridge.updates.getState();
    await bridge.updates.check();
    await bridge.updates.download();
    await bridge.updates.install();

    expect(electron.invoke.mock.calls).toEqual([
      [IPC_CHANNELS.platform],
      [IPC_CHANNELS.pickDirectory, {}],
      [IPC_CHANNELS.pickFile, { title: "Modelo" }],
      [IPC_CHANNELS.settingsApply, apply],
      [IPC_CHANNELS.settingsProbe, probe],
      [IPC_CHANNELS.lifecycleStatus],
      [IPC_CHANNELS.updatesState],
      [IPC_CHANNELS.updatesCheck],
      [IPC_CHANNELS.updatesDownload],
      [IPC_CHANNELS.updatesInstall],
    ]);
  });

  it("subscribes only to fixed event channels and returns exact cleanup", () => {
    const bridge = createBentoBridge(electron);
    const progress = vi.fn();
    const lifecycle = vi.fn();
    const removeProgress = bridge.settings.onProgress(progress);
    const removeLifecycle = bridge.lifecycle.onStatus(lifecycle);
    const update = vi.fn();
    const removeUpdate = bridge.updates.onState(update);

    expect(electron.on).toHaveBeenCalledTimes(3);
    expect(electron.on.mock.calls[0]?.[0]).toBe(IPC_CHANNELS.settingsProgress);
    expect(electron.on.mock.calls[1]?.[0]).toBe(IPC_CHANNELS.lifecycleChanged);
    expect(electron.on.mock.calls[2]?.[0]).toBe(IPC_CHANNELS.updatesChanged);
    const progressGuard = electron.on.mock.calls[0]?.[1] as (_event: unknown, payload: unknown) => void;
    const lifecycleGuard = electron.on.mock.calls[1]?.[1] as (_event: unknown, payload: unknown) => void;
    const updateGuard = electron.on.mock.calls[2]?.[1] as (_event: unknown, payload: unknown) => void;
    progressGuard({}, { phase: "validating", status: "ok" });
    lifecycleGuard({}, { state: "ready", recoveryMode: false });
    updateGuard({}, { status: "available", currentVersion: "0.1.0", installMode: "manual" });
    expect(progress).toHaveBeenCalledWith({ phase: "validating", status: "ok" });
    expect(lifecycle).toHaveBeenCalledWith({ state: "ready", recoveryMode: false });
    expect(update).toHaveBeenCalledWith({ status: "available", currentVersion: "0.1.0", installMode: "manual" });

    removeProgress();
    removeLifecycle();
    removeUpdate();
    expect(electron.removeListener).toHaveBeenCalledWith(IPC_CHANNELS.settingsProgress, progressGuard);
    expect(electron.removeListener).toHaveBeenCalledWith(IPC_CHANNELS.lifecycleChanged, lifecycleGuard);
    expect(electron.removeListener).toHaveBeenCalledWith(IPC_CHANNELS.updatesChanged, updateGuard);
  });
});
