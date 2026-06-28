import { describe, expect, it, vi } from "vitest";

import { createApiClient } from "../../api/client";
import { getSettings } from "../../api/settings";

describe("settings api", () => {
  it("requests public settings from the contracted endpoint", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ storage_backend: "local", telegram_enabled: false, worker_concurrency: 1 }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );
    const client = createApiClient({ baseUrl: "/api", fetcher });

    await expect(getSettings(client)).resolves.toEqual({
      storage_backend: "local",
      telegram_enabled: false,
      worker_concurrency: 1,
    });
    expect(fetcher).toHaveBeenCalledWith("/api/settings", expect.any(Object));
  });
});
