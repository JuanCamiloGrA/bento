import { describe, expect, it, vi } from "vitest";

import { createSearchApi } from "../../api/search";

describe("search API", () => {
  it("submits search requests to /api/search with filters", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ facets: [], items: [], next_cursor: null }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );
    const client = createSearchApi({ baseUrl: "/api", fetcher });

    await client.search({
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      folderId: "folder-1",
      q: "factura",
      type: "document",
    });

    expect(fetcher).toHaveBeenCalledWith(
      "/api/search?q=factura&type=document&folder_id=folder-1&date_from=2026-01-01&date_to=2026-01-31",
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
  });
});
