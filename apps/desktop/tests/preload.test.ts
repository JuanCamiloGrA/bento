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
    expect(Object.keys(bridge).sort()).toEqual(["lifecycle", "pickDirectory", "pickFile", "platform", "settings"]);
    expect(Object.keys(bridge.settings).sort()).toEqual(["apply", "onProgress", "probe"]);
    expect(Object.keys(bridge.lifecycle).sort()).toEqual(["onStatus", "status"]);
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

    expect(electron.invoke.mock.calls).toEqual([
      [IPC_CHANNELS.platform],
      [IPC_CHANNELS.pickDirectory, {}],
      [IPC_CHANNELS.pickFile, { title: "Modelo" }],
      [IPC_CHANNELS.settingsApply, apply],
      [IPC_CHANNELS.settingsProbe, probe],
      [IPC_CHANNELS.lifecycleStatus],
    ]);
  });

  it("subscribes only to fixed event channels and returns exact cleanup", () => {
    const bridge = createBentoBridge(electron);
    const progress = vi.fn();
    const lifecycle = vi.fn();
    const removeProgress = bridge.settings.onProgress(progress);
    const removeLifecycle = bridge.lifecycle.onStatus(lifecycle);

    expect(electron.on).toHaveBeenCalledTimes(2);
    expect(electron.on.mock.calls[0]?.[0]).toBe(IPC_CHANNELS.settingsProgress);
    expect(electron.on.mock.calls[1]?.[0]).toBe(IPC_CHANNELS.lifecycleChanged);
    const progressGuard = electron.on.mock.calls[0]?.[1] as (_event: unknown, payload: unknown) => void;
    const lifecycleGuard = electron.on.mock.calls[1]?.[1] as (_event: unknown, payload: unknown) => void;
    progressGuard({}, { phase: "validating", status: "ok" });
    lifecycleGuard({}, { state: "ready", recoveryMode: false });
    expect(progress).toHaveBeenCalledWith({ phase: "validating", status: "ok" });
    expect(lifecycle).toHaveBeenCalledWith({ state: "ready", recoveryMode: false });

    removeProgress();
    removeLifecycle();
    expect(electron.removeListener).toHaveBeenCalledWith(IPC_CHANNELS.settingsProgress, progressGuard);
    expect(electron.removeListener).toHaveBeenCalledWith(IPC_CHANNELS.lifecycleChanged, lifecycleGuard);
  });
});
