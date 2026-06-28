import { describe, expect, it, vi } from "vitest";

import { createApiClient } from "../../api/client";
import { enqueueReindex, listJobs, retryJob } from "../../api/jobs";

describe("jobs api", () => {
  it("uses the contracted jobs endpoints", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );
    const client = createApiClient({ baseUrl: "/api", fetcher });

    await listJobs({ limit: 10 }, client);

    expect(fetcher).toHaveBeenCalledWith("/api/jobs?limit=10", expect.any(Object));
  });

  it("posts failed job retries and admin reindex requests", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
      new Response(JSON.stringify({ id: "job 1" }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
      ),
    );
    const client = createApiClient({ baseUrl: "/api", fetcher });

    await retryJob("job 1", client);
    await enqueueReindex(client);

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "/api/jobs/job%201/retry",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(2, "/api/admin/reindex", expect.objectContaining({ method: "POST" }));
  });
});
