import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const desktopRoot = path.resolve(import.meta.dirname, "..");

describe("native packaging scaffold", () => {
  it("packages an asar app with a platform-native sidecar resource and no development sources", async () => {
    const forgeSource = await readFile(path.join(desktopRoot, "forge.config.cjs"), "utf8");
    expect(forgeSource).toContain("asar: true");
    expect(forgeSource).toContain("resources\", \"sidecars\", `${process.platform}-${process.arch}`");
    for (const excluded of ["src", "tests", "scripts", "resources"]) {
      expect(forgeSource).toMatch(new RegExp(`\\^\\\\/${excluded}\\(\\$\\|`, "u"));
    }
    expect(forgeSource).not.toMatch(/\.env(?:\.example)?["']/u);
  });

  it("locks production Electron fuses against Node/inspect escape hatches", async () => {
    const forgeSource = await readFile(path.join(desktopRoot, "forge.config.cjs"), "utf8");
    expect(forgeSource).toMatch(/RunAsNode\]: false/u);
    expect(forgeSource).toMatch(/EnableNodeOptionsEnvironmentVariable\]: false/u);
    expect(forgeSource).toMatch(/EnableNodeCliInspectArguments\]: false/u);
    expect(forgeSource).toMatch(/EnableEmbeddedAsarIntegrityValidation\]: true/u);
    expect(forgeSource).toMatch(/OnlyLoadAppFromAsar\]: true/u);
    expect(forgeSource).toMatch(/EnableCookieEncryption\]: true/u);
  });

  it("declares native makers without pretending to cross-compile sidecars", async () => {
    const forgeSource = await readFile(path.join(desktopRoot, "forge.config.cjs"), "utf8");
    expect(forgeSource).toContain("@electron-forge/maker-squirrel");
    expect(forgeSource).toContain("@electron-forge/maker-dmg");
    expect(forgeSource).toContain("@electron-forge/maker-deb");
    expect(forgeSource).toContain("@electron-forge/maker-zip");
    expect(forgeSource).toContain("process.platform");
    expect(forgeSource).toContain("process.arch");
  });

  it("provides a bounded packaged smoke using an isolated user profile", async () => {
    const packageJson = JSON.parse(await readFile(path.join(desktopRoot, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts["smoke:packaged"]).toBe("node scripts/smoke-packaged.mjs");
    const smoke = await readFile(path.join(desktopRoot, "scripts", "smoke-packaged.mjs"), "utf8");
    expect(smoke).toContain("BENTO_DESKTOP_SMOKE");
    expect(smoke).toContain("XDG_CONFIG_HOME");
    expect(smoke).toContain("45_000");
    expect(smoke).toContain('child.kill("SIGKILL")');
    expect(smoke).toMatch(/electron\\\/default_app\|localhost:5173\|ERR_FILE_NOT_FOUND/u);
    expect(smoke).toContain("await rm(profile, { recursive: true, force: true })");
  });
});
