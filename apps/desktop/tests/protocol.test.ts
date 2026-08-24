import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const electron = vi.hoisted(() => ({ netFetch: vi.fn() }));
vi.mock("electron", () => ({ net: { fetch: electron.netFetch } }));

import { CSP, isAllowedNavigation, registerBentoProtocol } from "../src/main/protocol";

function setup() {
  let handler: ((request: Request) => Promise<Response>) | undefined;
  const protocol = { handle: vi.fn((_scheme: string, value: typeof handler) => { handler = value; }) };
  const api = { apiFetch: vi.fn(async () => new Response("api", { status: 200 })) };
  registerBentoProtocol(protocol as never, "/opt/bento/renderer", api);
  return { api, handler: handler!, protocol };
}

describe("bento protocol", () => {
  it.each([
    ["bento://app/", true],
    ["bento://app/settings", true],
    ["https://app/settings", false],
    ["bento://evil/settings", false],
    ["bento://user:password@app/settings", false],
    ["file:///opt/bento/renderer/index.html", false],
    ["javascript:alert(1)", false],
    ["not a URL", false],
  ])("navigation allowlist: %s => %s", (url, expected) => {
    expect(isAllowedNavigation(url)).toBe(expected);
  });

  it("rejects other hosts without touching disk or API", async () => {
    const { api, handler } = setup();
    await expect(handler(new Request("bento://evil/index.html"))).resolves.toMatchObject({ status: 404 });
    expect(api.apiFetch).not.toHaveBeenCalled();
    expect(electron.netFetch).not.toHaveBeenCalled();
  });

  it("proxies only /api and strips renderer-controlled credentials", async () => {
    const { api, handler } = setup();
    await handler(new Request("bento://app/api/settings/values?view=public", {
      headers: {
        authorization: "Bearer attacker-value",
        cookie: "session=attacker",
        origin: "https://attacker.example",
        "x-safe-header": "kept",
      },
    }));

    expect(api.apiFetch).toHaveBeenCalledOnce();
    const [pathname, init] = api.apiFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(pathname).toBe("/api/settings/values?view=public");
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("cookie")).toBeNull();
    expect(headers.get("origin")).toBeNull();
    expect(headers.get("x-safe-header")).toBe("kept");
  });

  it("serves renderer files with strict response security headers", async () => {
    const { handler } = setup();
    electron.netFetch.mockResolvedValueOnce(new Response("asset", { status: 200, headers: { "content-type": "text/javascript" } }));
    const response = await handler(new Request("bento://app/assets/app.js"));
    expect(electron.netFetch).toHaveBeenCalledWith(expect.stringMatching(/^file:\/\/\/opt\/bento\/renderer\/assets\/app\.js$/u));
    expect(response.headers.get("content-security-policy")).toBe(CSP);
    expect(response.headers.get("cross-origin-opener-policy")).toBe("same-origin");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("uses index.html for client routes and does not resolve traversal outside renderer root", async () => {
    const { handler } = setup();
    electron.netFetch.mockResolvedValue(new Response("index", { status: 200 }));
    await handler(new Request("bento://app/settings/general"));
    expect(electron.netFetch).toHaveBeenLastCalledWith(expect.stringMatching(/\/opt\/bento\/renderer\/index\.html$/u));

    for (const pathname of ["/%2e%2e/%2e%2e/etc/passwd", "/..%2f..%2fetc/passwd", "/%00/asset.js"]) {
      electron.netFetch.mockClear();
      await handler(new Request(`bento://app${pathname}`));
      for (const [fileUrl] of electron.netFetch.mock.calls) {
        expect(fileUrl).toMatch(/^file:\/\/\/opt\/bento\/renderer\//u);
        expect(fileUrl).not.toBe(`file://${path.join("etc", "passwd")}`);
      }
    }
  });
});
