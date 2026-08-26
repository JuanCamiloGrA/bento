import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SecureSecretStore } from "../src/main/secrets";

const temporaryDirectories: string[] = [];

async function secretPath(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "bento-secret-test-"));
  temporaryDirectories.push(directory);
  return path.join(directory, "secrets.json");
}

function fakeSafeStorage(available = true, backend = "kwallet") {
  return {
    isAsyncEncryptionAvailable: vi.fn(async () => available),
    encryptStringAsync: vi.fn(async (value: string) => Buffer.from(`cipher:${value}`, "utf8")),
    decryptStringAsync: vi.fn(async (value: Buffer) => ({
      result: value.toString("utf8").replace(/^cipher:/u, ""),
      shouldReEncrypt: false,
    })),
    getSelectedStorageBackend: vi.fn(() => backend),
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("OS-backed secure secret storage", () => {
  it("fails closed when encryption is unavailable without writing plaintext", async () => {
    const file = await secretPath();
    const storage = fakeSafeStorage(false);
    const store = new SecureSecretStore(file, storage, "darwin");

    await expect(store.prepare({ telegram_bot_token: { operation: "set", value: "plaintext-token" } })).rejects.toThrow(
      /unavailable/i,
    );
    await expect(readFile(file, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    expect(storage.encryptStringAsync).not.toHaveBeenCalled();
  });

  it("rejects Linux basic_text as an insecure fallback", async () => {
    const file = await secretPath();
    const storage = fakeSafeStorage(true, "basic_text");
    const store = new SecureSecretStore(file, storage, "linux");
    await expect(store.available()).resolves.toBe(false);
    await expect(store.prepare({ token: { operation: "set", value: "secret" } })).rejects.toThrow(/unavailable/i);
  });

  it("persists only encrypted payloads and opaque references", async () => {
    const file = await secretPath();
    const storage = fakeSafeStorage();
    const store = new SecureSecretStore(file, storage, "linux");
    const prepared = await store.prepare({ telegram_bot_token: { operation: "set", value: "plaintext-token" } });

    expect(prepared.references.telegram_bot_token).toMatchObject({ configured: true });
    expect(prepared.references.telegram_bot_token?.reference).toMatch(/^desktop-secret:/u);
    expect(prepared.values).toEqual({ telegram_bot_token: "plaintext-token" });
    await prepared.commit();

    const raw = await readFile(file, "utf8");
    expect(raw).not.toContain("plaintext-token");
    expect(raw).toContain(Buffer.from("cipher:plaintext-token").toString("base64"));
    await expect(store.values()).resolves.toEqual({ telegram_bot_token: "plaintext-token" });
    await expect(store.references()).resolves.toEqual({
      telegram_bot_token: prepared.references.telegram_bot_token?.reference,
    });
  });

  it("supports transactional rollback for rotation and clear mutations", async () => {
    const file = await secretPath();
    const store = new SecureSecretStore(file, fakeSafeStorage(), "darwin");
    const initial = await store.prepare({ token: { operation: "set", value: "first-value" } });
    await initial.commit();

    const changed = await store.prepare({
      token: { operation: "set", value: "second-value" },
      absent: { operation: "clear" },
    });
    expect(changed.references.token?.reference).toBe(initial.references.token?.reference);
    expect(changed.references.absent).toEqual({ reference: null, configured: false });
    await changed.commit();
    await expect(store.values()).resolves.toEqual({ token: "second-value" });
    await changed.rollback();
    await expect(store.values()).resolves.toEqual({ token: "first-value" });
  });

  it("rejects malformed secret metadata rather than treating it as empty", async () => {
    const file = await secretPath();
    const { writeFile } = await import("node:fs/promises");
    await writeFile(file, JSON.stringify({ version: 1, secrets: { token: { reference: "raw", encrypted: "" } } }));
    const store = new SecureSecretStore(file, fakeSafeStorage(), "darwin");
    await expect(store.references()).rejects.toThrow(/invalid/i);
  });
});
