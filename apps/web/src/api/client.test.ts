import { describe, expect, it, vi } from "vitest";

import { ApiError, createApiClient, resolveApiBaseUrl } from "./client";

describe("api client", () => {
  it("normalizes the configured base URL", () => {
    expect(resolveApiBaseUrl("http://localhost:8000/api/")).toBe("http://localhost:8000/api");
    expect(resolveApiBaseUrl("")).toBe("/api");
  });

  it("requests JSON through the configured fetcher", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );
    const client = createApiClient({ baseUrl: "/api", fetcher });

    await expect(client.request<{ ok: boolean }>("/health")).resolves.toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledWith("/api/health", expect.objectContaining({ headers: expect.any(Headers) }));
  });

  it("serializes query parameters and omits empty values", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 200 }));
    const client = createApiClient({ baseUrl: "/api", fetcher });

    await client.request("/jobs", { query: { cursor: null, limit: 25, status: "failed" } });

    expect(fetcher).toHaveBeenCalledWith(
      "/api/jobs?limit=25&status=failed",
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
  });

  it("raises typed errors for failed responses", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ code: "bad_request" }), {
        headers: { "content-type": "application/json" },
        status: 400,
        statusText: "Bad Request",
      }),
    );
    const client = createApiClient({ baseUrl: "/api", fetcher });

    await expect(client.request("/broken")).rejects.toBeInstanceOf(ApiError);
  });
});
