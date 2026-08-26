import { afterEach, describe, expect, it, vi } from "vitest";

import { desktopBridge, detectDesktopPlatform } from "../../api/settingsDesktop";

afterEach(() => { delete window.bento; });

describe("desktop settings bridge detection", () => {
  it("uses a present narrow bridge without assuming Node access", async () => {
    const platform = { arch: "arm64", desktop: true as const, platform: "darwin" as const, recoveryMode: false, secureStorage: "available" as const, version: "1.0.0" };
    window.bento = {
      lifecycle: { onStatus: vi.fn(() => vi.fn()), status: vi.fn() },
      pickDirectory: vi.fn(), pickFile: vi.fn(), platform: vi.fn().mockResolvedValue(platform),
      settings: { apply: vi.fn(), onProgress: vi.fn(() => vi.fn()), probe: vi.fn() },
    };
    expect(desktopBridge()).toBe(window.bento);
    await expect(detectDesktopPlatform()).resolves.toEqual(platform);
  });

  it("falls back cleanly when the bridge is absent", async () => {
    expect(desktopBridge()).toBeNull();
    await expect(detectDesktopPlatform()).resolves.toBeNull();
  });
});
