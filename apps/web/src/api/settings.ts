import { apiClient } from "./client";
import type { ApiClient } from "./client";

export type StorageBackend = "local" | "telegram" | string;
export type ProviderState = "disabled" | "pending" | "ready" | "error" | string;
export type WorkerStatus = "stopped" | "running" | "degraded" | string;

export type PublicSettings = {
  data_paths?: Record<string, string>;
  embeddings_enabled?: boolean;
  embeddings_state?: ProviderState;
  model_available?: boolean;
  ocr_enabled?: boolean;
  ocr_state?: ProviderState;
  storage_backend: StorageBackend;
  telegram_configured?: boolean;
  telegram_enabled?: boolean;
  worker_concurrency?: number;
  worker_status?: WorkerStatus;
};

export function getSettings(client: ApiClient = apiClient): Promise<PublicSettings> {
  return client.request<PublicSettings>("/settings");
}
