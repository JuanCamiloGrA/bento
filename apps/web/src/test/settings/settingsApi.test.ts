import { describe, expect, it, vi } from "vitest";

import { createApiClient } from "../../api/client";
import { exportSettings, getSettings, getSettingsSchema, getSettingsValues, patchSettings, previewSettingsImport, reclaimStorage, validateSettings } from "../../api/settings";

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

describe("storage maintenance api", () => {
  it("requests guarded cache reclamation", async () => {
    const payload = { deleted_files: 2, freed_bytes: 4096, retained_bytes: 0, retained_files: 0, skipped_recent_files: 0 };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(payload), { headers: { "content-type": "application/json" }, status: 200 }),
    );
    const client = createApiClient({ baseUrl: "/api", fetcher });

    await expect(reclaimStorage(client)).resolves.toEqual(payload);
    expect(fetcher).toHaveBeenCalledWith("/api/admin/storage/reclaim", expect.objectContaining({ method: "POST" }));
  });
});

describe("editable settings api", () => {
  it("uses the schema, values, validation, patch, import and safe export contracts", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () =>
      new Response(JSON.stringify({ revision: 4, fields: [], values: {}, valid: true }), {
        headers: { "content-type": "application/json" }, status: 200,
      }),
    );
    const client = createApiClient({ baseUrl: "/api", fetcher });

    await getSettingsSchema(client);
    await getSettingsValues(client);
    await validateSettings({ run_probes: true, values: { worker_concurrency: 1 } }, client);
    await patchSettings({ revision: 4, values: { worker_concurrency: 1 } }, client);
    await previewSettingsImport("WORKER_CONCURRENCY=1", client);
    await exportSettings(client);

    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "/api/settings/schema", "/api/settings/values", "/api/settings/validate",
      "/api/settings/values", "/api/settings/import/preview", "/api/settings/export",
    ]);
    expect(fetcher.mock.calls[2]?.[1]).toEqual(expect.objectContaining({ method: "POST" }));
    expect(fetcher.mock.calls[3]?.[1]).toEqual(expect.objectContaining({ method: "PATCH" }));
  });
});
