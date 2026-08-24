import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BootstrapStore } from "../src/main/bootstrap";

const temporaryDirectories: string[] = [];

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "bento-bootstrap-test-"));
  temporaryDirectories.push(directory);
  const file = path.join(directory, "config", "bootstrap.json");
  const dataDir = path.join(directory, "data");
  return { dataDir, file, store: new BootstrapStore(file, dataDir) };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("minimal desktop bootstrap metadata", () => {
  it("creates a safe first-run state atomically with private permissions", async () => {
    const { dataDir, file, store } = await fixture();
    await expect(store.load()).resolves.toEqual({ schemaVersion: 1, dataDir, lastKnownGoodRevision: 0 });
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual({ schemaVersion: 1, dataDir, lastKnownGoodRevision: 0 });
    if (process.platform !== "win32") expect((await stat(file)).mode & 0o777).toBe(0o600);
    await expect(readFile(`${file}.tmp`, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("persists and reloads only schema, safe data directory, and last-known-good revision", async () => {
    const { dataDir, file, store } = await fixture();
    await store.save({ schemaVersion: 1, dataDir, lastKnownGoodRevision: 9 });
    await expect(new BootstrapStore(file, "/ignored/default").load()).resolves.toEqual({
      schemaVersion: 1,
      dataDir,
      lastKnownGoodRevision: 9,
    });
    expect(Object.keys(JSON.parse(await readFile(file, "utf8"))).sort()).toEqual([
      "dataDir",
      "lastKnownGoodRevision",
      "schemaVersion",
    ]);
  });

  it.each([
    { schemaVersion: 2, dataDir: "/tmp/bento", lastKnownGoodRevision: 0 },
    { schemaVersion: 1, dataDir: "/tmp/bento", lastKnownGoodRevision: -1 },
    { schemaVersion: 1, dataDir: "/tmp/bento", lastKnownGoodRevision: 1.5 },
    { schemaVersion: 1, dataDir: "relative/path", lastKnownGoodRevision: 0 },
  ])("fails closed for malformed or unsafe persisted metadata %#", async (document) => {
    const { file, store } = await fixture();
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(document));
    await expect(store.load()).rejects.toThrow();
  });

  it("rejects filesystem roots for both initial and updated data locations", async () => {
    const { file } = await fixture();
    const root = path.parse(process.cwd()).root;
    const store = new BootstrapStore(file, root);
    await expect(store.load()).rejects.toThrow(/root/i);
    await expect(store.save({ schemaVersion: 1, dataDir: root, lastKnownGoodRevision: 0 })).rejects.toThrow(/root/i);
  });
});
