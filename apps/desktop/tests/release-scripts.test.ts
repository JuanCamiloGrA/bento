import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const run = promisify(execFile);
const desktopRoot = path.resolve(import.meta.dirname, "..");

describe("release metadata scripts", () => {
  it("creates checksums only for distributables and SBOM files", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "bento-checksums-"));
    try {
      const source = path.join(root, "source");
      const staged = path.join(root, "staged");
      const makerDirectory = path.join(source, "make", "zip", "linux", "x64");
      await mkdir(makerDirectory, { recursive: true });
      await writeFile(path.join(makerDirectory, "Bento.zip"), "artifact");
      await writeFile(path.join(source, "bento-linux.cdx.json"), "{}\n");
      await mkdir(path.join(source, "Bento-linux-x64"));
      await writeFile(path.join(source, "Bento-linux-x64", "bento"), "packaged executable");
      await run(process.execPath, [path.join(desktopRoot, "scripts", "stage-artifacts.mjs"), source, staged]);
      await run(process.execPath, [path.join(desktopRoot, "scripts", "checksums.mjs"), staged, "SHA256SUMS-test"]);
      const checksum = await readFile(path.join(staged, "SHA256SUMS-test"), "utf8");
      expect(checksum.trim().split("\n")).toHaveLength(2);
      expect(checksum).toContain(createHash("sha256").update("artifact").digest("hex"));
      expect(checksum).toContain("  Bento.zip");
      expect(checksum).not.toContain("make/");
      expect(checksum).not.toContain("Bento-linux-x64/bento");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("creates a CycloneDX document from both locked ecosystems", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "bento-sbom-"));
    try {
      const output = path.join(root, "bento.cdx.json");
      await run(process.execPath, [path.join(desktopRoot, "scripts", "generate-sbom.mjs"), output]);
      const bom = JSON.parse(await readFile(output, "utf8")) as {
        bomFormat: string;
        specVersion: string;
        metadata: { component: { version: string } };
        components: unknown[];
      };
      expect(bom.bomFormat).toBe("CycloneDX");
      expect(bom.specVersion).toBe("1.5");
      expect(bom.metadata.component.version).toBe("0.1.0");
      expect(bom.components.length).toBeGreaterThan(100);
      const components = bom.components as Array<{ name: string; purl: string }>;
      const scoped = components.find((component) => component.name === "@babel/core");
      expect(scoped?.purl).toMatch(/^pkg:npm\/%40babel\/core@[^/]+$/u);
      expect(components.every((component) => !component.name.includes("node_modules/"))).toBe(true);
      expect(components.filter((component) => component.purl.startsWith("pkg:npm/")).every((component) => !component.purl.includes("%2F"))).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects flattened artifact basename collisions", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "bento-stage-collision-"));
    try {
      const source = path.join(root, "source", "make");
      await mkdir(path.join(source, "one"), { recursive: true });
      await mkdir(path.join(source, "two"), { recursive: true });
      await writeFile(path.join(source, "one", "Bento.zip"), "one");
      await writeFile(path.join(source, "two", "bento.ZIP"), "two");
      await expect(run(process.execPath, [
        path.join(desktopRoot, "scripts", "stage-artifacts.mjs"),
        path.dirname(source),
        path.join(root, "staged"),
      ])).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("accepts only a tag exactly matching the desktop package version", async () => {
    const script = path.join(desktopRoot, "scripts", "validate-release-tag.mjs");
    await expect(run(process.execPath, [script, "v0.1.0"])).resolves.toMatchObject({ stdout: expect.stringContaining("v0.1.0") });
    await expect(run(process.execPath, [script, "v0.1.1"])).rejects.toThrow();
    await expect(run(process.execPath, [script, "v0.1.0-rc.1"])).rejects.toThrow();
  });
});
