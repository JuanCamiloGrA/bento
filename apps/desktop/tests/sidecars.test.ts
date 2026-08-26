import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { BENTO_ORIGIN } from "../src/shared/contracts";
import { SidecarSupervisor } from "../src/main/sidecars";

class FakeChild extends EventEmitter {
  pid = 42;
  exitCode: number | null = null;
  stdout = new PassThrough();
  stderr = new PassThrough();
  signals: NodeJS.Signals[] = [];

  kill(signal: NodeJS.Signals = "SIGTERM"): boolean {
    this.signals.push(signal);
    if (signal === "SIGTERM") this.exit(0, signal);
    return true;
  }

  exit(code: number, signal: NodeJS.Signals | null = null): void {
    if (this.exitCode !== null) return;
    this.exitCode = code;
    this.emit("exit", code, signal);
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function setup() {
  const launches: Array<{ command: string; args: string[]; child: FakeChild; env: NodeJS.ProcessEnv }> = [];
  const fetch = vi.fn(async () => jsonResponse({ status: "ready" }));
  const delay = vi.fn(async () => undefined);
  const supervisor = new SidecarSupervisor({
    command: { executable: "bento-sidecar", prefixArguments: [] },
    dataDir: "/tmp/bento-test-data",
    secretEnvironment: { telegram_bot_token: "telegram-secret" },
    reservePort: async () => 43127,
    randomToken: () => "unguessable-per-launch-token-1234567890",
    fetch,
    delay,
    spawnProcess: (_executable, arguments_, options) => {
      const child = new FakeChild();
      const command = arguments_[0] ?? "";
      launches.push({ command, args: arguments_.slice(1), child, env: options.env });
      if (command === "migrate" || command === "probe") queueMicrotask(() => child.exit(0));
      return child;
    },
  });
  return { delay, fetch, launches, supervisor };
}

describe("authenticated sidecar lifecycle", () => {
  it("starts migrate, then authenticated API readiness, then worker", async () => {
    const { fetch, launches, supervisor } = setup();
    await supervisor.start();

    expect(launches.map((launch) => launch.command)).toEqual(["migrate", "api", "worker"]);
    expect(launches[1]?.args).toEqual(["--host", "127.0.0.1", "--port", "43127"]);
    expect(launches[1]?.env).toMatchObject({
      BENTO_RUNTIME_MODE: "desktop",
      HOST: "127.0.0.1",
      API_PORT: "43127",
      DATA_DIR: "/tmp/bento-test-data",
      BENTO_DESKTOP_ORIGIN: BENTO_ORIGIN,
      TELEGRAM_BOT_TOKEN: "telegram-secret",
    });
    expect(launches[1]?.env.BENTO_DESKTOP_API_TOKEN?.length).toBeGreaterThanOrEqual(32);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:43127/api/desktop/readiness");
    const headers = new Headers(init.headers);
    expect(headers.get("origin")).toBe(BENTO_ORIGIN);
    expect(headers.get("authorization")).toBe("Bearer unguessable-per-launch-token-1234567890");
    expect(supervisor.status).toEqual({ state: "ready", recoveryMode: false });
  });

  it("keeps the desktop secret environment mapping aligned with the canonical backend registry", async () => {
    const expectedAliases = {
      telegram_bot_token: "TELEGRAM_BOT_TOKEN",
      telegram_api_id: "TELEGRAM_API_ID",
      telegram_api_hash: "TELEGRAM_API_HASH",
      telegram_raw_chat_id: "TELEGRAM_RAW_CHAT_ID",
      telegram_thumbs_chat_id: "TELEGRAM_THUMBS_CHAT_ID",
      telegram_journal_chat_id: "TELEGRAM_JOURNAL_CHAT_ID",
      telegram_webhook_secret: "TELEGRAM_WEBHOOK_SECRET",
      bento_encryption_key: "BENTO_ENCRYPTION_KEY",
    } as const;
    const registryPath = path.resolve(import.meta.dirname, "../../api/src/bento/domain/settings_registry.py");
    const registry = await readFile(registryPath, "utf8");
    const registeredSecrets = [...registry.matchAll(
      /_field\("([a-z0-9_]+)", \("([A-Z0-9_]+)"(?:,\s*"[A-Z0-9_]+")*,?\),[^\n]*secret=True\)/gu,
    )].map((match) => [match[1], match[2]] as const);
    expect(Object.fromEntries(registeredSecrets)).toEqual(expectedAliases);

    const secretValues = Object.fromEntries(Object.keys(expectedAliases).map((key) => [key, `value-for-${key}`]));
    const launches: Array<{ command: string; env: NodeJS.ProcessEnv }> = [];
    const supervisor = new SidecarSupervisor({
      command: { executable: "bento-sidecar", prefixArguments: [] },
      dataDir: "/tmp/bento-test-data",
      secretEnvironment: { ...secretValues, unknown_secret: "must-not-leak" },
      reservePort: async () => 43127,
      randomToken: () => "unguessable-per-launch-token-1234567890",
      fetch: async () => jsonResponse({ status: "ready" }),
      spawnProcess: (_executable, arguments_, options) => {
        const child = new FakeChild();
        const command = arguments_[0] ?? "";
        launches.push({ command, env: options.env });
        if (command === "migrate") queueMicrotask(() => child.exit(0));
        return child;
      },
    });
    await supervisor.start();

    const apiEnvironment = launches.find((launch) => launch.command === "api")!.env;
    for (const [key, alias] of Object.entries(expectedAliases)) {
      expect(apiEnvironment[alias]).toBe(secretValues[key]);
    }
    expect(Object.values(apiEnvironment)).not.toContain("must-not-leak");
  });

  it("never proxies outside the relative API allowlist", async () => {
    const { fetch, supervisor } = setup();
    await supervisor.start();
    for (const candidate of ["/health", "http://evil.test/api/x", "//evil.test/api/x", "/api/../admin"]) {
      await expect(supervisor.apiFetch(candidate)).rejects.toThrow();
    }
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("restarts only the requested process group", async () => {
    const { launches, supervisor } = setup();
    await supervisor.start();
    const originalApi = launches[1]!.child;
    const originalWorker = launches[2]!.child;

    await supervisor.restart(["worker"]);
    expect(originalWorker.signals).toEqual(["SIGTERM"]);
    expect(originalApi.signals).toEqual([]);
    expect(launches.map((launch) => launch.command)).toEqual(["migrate", "api", "worker", "worker"]);

    await supervisor.restart(["api"]);
    expect(originalApi.signals).toEqual(["SIGTERM"]);
    expect(launches.slice(-2).map((launch) => launch.command)).toEqual(["api", "worker"]);
  });

  it("uses bounded exponential crash backoff and enters recovery after three crashes", async () => {
    const { delay, launches, supervisor } = setup();
    const statuses: unknown[] = [];
    supervisor.on("status", (status) => statuses.push(status));
    await supervisor.start();

    launches[2]!.child.exit(1);
    await vi.waitFor(() => expect(launches.filter((item) => item.command === "worker")).toHaveLength(2));
    launches.at(-1)!.child.exit(1);
    await vi.waitFor(() => expect(launches.filter((item) => item.command === "worker")).toHaveLength(3));
    launches.at(-1)!.child.exit(1);
    await vi.waitFor(() => expect(supervisor.status).toEqual({ state: "recovery", recoveryMode: true }));

    expect(delay.mock.calls.slice(0, 2).map(([milliseconds]) => milliseconds)).toEqual([500, 1_000]);
    expect(statuses).toContainEqual({ state: "recovery", recoveryMode: true });
  });

  it("stops worker and API gracefully without spawning recovery replacements", async () => {
    const { launches, supervisor } = setup();
    await supervisor.start();
    await supervisor.stop();
    expect(launches[1]?.child.signals).toEqual(["SIGTERM"]);
    expect(launches[2]?.child.signals).toEqual(["SIGTERM"]);
    await Promise.resolve();
    expect(launches).toHaveLength(3);
    expect(supervisor.status.state).toBe("stopping");
  });

  it("restores crash monitoring after a controlled restart throws", async () => {
    const launches: Array<{ command: string; child: FakeChild }> = [];
    let failNextWorker = false;
    const supervisor = new SidecarSupervisor({
      command: { executable: "bento-sidecar", prefixArguments: [] },
      dataDir: "/tmp/bento-test-data",
      reservePort: async () => 43127,
      randomToken: () => "unguessable-per-launch-token-1234567890",
      fetch: async () => jsonResponse({ status: "ready" }),
      delay: async () => undefined,
      spawnProcess: (_executable, arguments_) => {
        const command = arguments_[0] ?? "";
        if (command === "worker" && failNextWorker) {
          failNextWorker = false;
          throw new Error("worker launch failed");
        }
        const child = new FakeChild();
        launches.push({ command, child });
        if (command === "migrate") queueMicrotask(() => child.exit(0));
        return child;
      },
    });
    await supervisor.start();
    const api = launches.find((launch) => launch.command === "api")!.child;
    failNextWorker = true;
    await expect(supervisor.restart(["worker"])).rejects.toThrow("worker launch failed");

    api.exit(1);
    await vi.waitFor(() => expect(launches.filter((launch) => launch.command === "api")).toHaveLength(2));
    expect(supervisor.status).toEqual({ state: "ready", recoveryMode: false });
  });

  it("rejects weak launch authentication before starting migrations", async () => {
    const { launches, supervisor } = setup();
    const weak = new SidecarSupervisor({
      command: { executable: "bento-sidecar", prefixArguments: [] },
      dataDir: "/tmp/bento-test-data",
      reservePort: async () => 43127,
      randomToken: () => "weak",
      spawnProcess: () => {
        throw new Error("must not spawn");
      },
    });
    await expect(weak.start()).rejects.toThrow(/token.*short/i);
    expect(launches).toHaveLength(0);
  });
});
