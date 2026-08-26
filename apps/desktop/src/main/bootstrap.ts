import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateSafePath } from "./validation";

export interface BootstrapState {
  schemaVersion: 1;
  dataDir: string;
  lastKnownGoodRevision: number;
}

export class BootstrapStore {
  constructor(private readonly filePath: string, private readonly defaultDataDir: string) {}

  async load(): Promise<BootstrapState> {
    try {
      const value = JSON.parse(await readFile(this.filePath, "utf8")) as Partial<BootstrapState>;
      if (value.schemaVersion !== 1 || !Number.isSafeInteger(value.lastKnownGoodRevision) || (value.lastKnownGoodRevision ?? -1) < 0) {
        throw new Error("Desktop bootstrap metadata is invalid");
      }
      return { schemaVersion: 1, dataDir: validateSafePath(value.dataDir), lastKnownGoodRevision: value.lastKnownGoodRevision! };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const initial = { schemaVersion: 1 as const, dataDir: validateSafePath(this.defaultDataDir), lastKnownGoodRevision: 0 };
      await this.save(initial);
      return initial;
    }
  }

  async save(value: BootstrapState): Promise<void> {
    const safe = { ...value, dataDir: validateSafePath(value.dataDir) };
    await mkdir(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
    await writeFile(`${this.filePath}.tmp`, `${JSON.stringify(safe)}\n`, { mode: 0o600 });
    await rename(`${this.filePath}.tmp`, this.filePath);
  }
}
