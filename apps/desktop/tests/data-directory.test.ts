import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  statfs,
  symlink,
  truncate,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DataDirectoryMigrator } from "../src/main/data-directory";

const temporaryDirectories: string[] = [];

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "bento-data-migration-test-"));
  temporaryDirectories.push(root);
  const source = path.join(root, "source");
  const destination = path.join(root, "destination");
  await mkdir(source);
  return { destination, migrator: new DataDirectoryMigrator(), root, source };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("data directory migration safety", () => {
  it("requires an explicit copy or empty-directory choice", async () => {
    const { destination, migrator, source } = await fixture();
    await expect(migrator.validate(source, destination, undefined)).rejects.toThrow(/choose.*copy.*empty/i);
    await expect(readdir(destination)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects roots, identical directories, and directories nested in either direction", async () => {
    const { destination, migrator, root, source } = await fixture();
    const filesystemRoot = path.parse(root).root;
    await expect(migrator.validate(source, filesystemRoot, "use-empty")).rejects.toThrow(/root/i);
    await expect(migrator.validate(source, source, "use-empty")).rejects.toThrow(/different/i);
    await expect(migrator.validate(source, path.join(source, "nested"), "use-empty")).rejects.toThrow(/contain/i);
    await mkdir(path.join(destination, "nested"), { recursive: true });
    await expect(migrator.validate(path.join(destination, "nested"), destination, "use-empty")).rejects.toThrow(/contain/i);
  });

  it("rejects a non-empty destination without overwriting its contents", async () => {
    const { destination, migrator, source } = await fixture();
    await mkdir(destination);
    const marker = path.join(destination, "keep.txt");
    await writeFile(marker, "user data");
    await expect(migrator.validate(source, destination, "use-empty")).rejects.toThrow(/must be empty/i);
    await expect(readFile(marker, "utf8")).resolves.toBe("user data");
  });

  it("rejects symbolic links in the source tree before copy", async () => {
    const { destination, migrator, root, source } = await fixture();
    const outside = path.join(root, "outside.txt");
    await writeFile(outside, "must not follow");
    await symlink(outside, path.join(source, "link.txt"));
    await expect(migrator.validate(source, destination, "copy")).rejects.toThrow(/symbolic link/i);
  });

  it("rejects source or destination directory paths that are themselves symbolic links", async () => {
    const sourceFixture = await fixture();
    const realSource = path.join(sourceFixture.root, "real-source");
    const linkedSource = path.join(sourceFixture.root, "linked-source");
    await mkdir(realSource);
    await symlink(realSource, linkedSource, "dir");
    await expect(
      sourceFixture.migrator.validate(linkedSource, sourceFixture.destination, "copy"),
    ).rejects.toThrow(/symbolic link/i);

    const destinationFixture = await fixture();
    const realDestination = path.join(destinationFixture.root, "real-destination");
    const linkedDestination = path.join(destinationFixture.root, "linked-destination");
    await mkdir(realDestination);
    await symlink(realDestination, linkedDestination, "dir");
    await expect(
      destinationFixture.migrator.validate(destinationFixture.source, linkedDestination, "use-empty"),
    ).rejects.toThrow(/symbolic link/i);
  });

  it("rejects copy when required size plus safety margin exceeds free space", async () => {
    const { destination, migrator, source } = await fixture();
    await mkdir(destination);
    const filesystem = await statfs(destination);
    const available = Number(filesystem.bavail) * Number(filesystem.bsize);
    const sparseSize = Math.min(Number.MAX_SAFE_INTEGER - 1, Math.max(available * 2, 1_000_000_000));
    const sparseFile = path.join(source, "oversized-sparse.bin");
    await writeFile(sparseFile, "");
    await truncate(sparseFile, sparseSize);
    await expect(migrator.validate(source, destination, "copy")).rejects.toThrow(/enough free space/i);
  });

  it("copies the source tree only in copy mode", async () => {
    const copyFixture = await fixture();
    await mkdir(path.join(copyFixture.source, "nested"));
    await writeFile(path.join(copyFixture.source, "nested", "asset.bin"), "asset payload");
    const copyDestination = await copyFixture.migrator.validate(
      copyFixture.source,
      copyFixture.destination,
      "copy",
    );
    await copyFixture.migrator.execute(copyFixture.source, copyDestination, "copy");
    await expect(readFile(path.join(copyDestination, "nested", "asset.bin"), "utf8")).resolves.toBe("asset payload");

    const emptyFixture = await fixture();
    await writeFile(path.join(emptyFixture.source, "database.sqlite3"), "old database");
    const emptyDestination = await emptyFixture.migrator.validate(
      emptyFixture.source,
      emptyFixture.destination,
      "use-empty",
    );
    await emptyFixture.migrator.execute(emptyFixture.source, emptyDestination, "use-empty");
    await expect(readdir(emptyDestination)).resolves.toEqual([]);
  });
});
