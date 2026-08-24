import { apiClient } from "./client";
import type { ApiClient } from "./client";

export type StorageBackend = "local" | "telegram" | string;
export type ProviderState = "disabled" | "pending" | "ready" | "error" | string;
export type WorkerStatus = "stopped" | "running" | "degraded" | string;
export type TelegramConnectionState = "connected" | "unavailable" | "not_configured" | string;

export type StorageMaintenanceStatus = {
  can_reclaim: boolean;
  connection_state: TelegramConnectionState;
  fully_remote: boolean;
  local_blob_count: number;
  reclaimable_bytes: number;
  reclaimable_files: number;
  telegram_blob_count: number;
};

export type StorageReclaimResult = {
  deleted_files: number;
  freed_bytes: number;
  retained_bytes: number;
  retained_files: number;
  skipped_recent_files: number;
};

export type PublicSettings = {
  data_paths?: Record<string, string>;
  embeddings_enabled?: boolean;
  embeddings_state?: ProviderState;
  model_available?: boolean;
  ocr_enabled?: boolean;
  ocr_state?: ProviderState;
  storage_backend: StorageBackend;
  storage_maintenance?: StorageMaintenanceStatus;
  telegram_configured?: boolean;
  telegram_enabled?: boolean;
  worker_concurrency?: number;
  worker_status?: WorkerStatus;
};

export function getSettings(client: ApiClient = apiClient): Promise<PublicSettings> {
  return client.request<PublicSettings>("/settings");
}

export function reclaimStorage(client: ApiClient = apiClient): Promise<StorageReclaimResult> {
  return client.request<StorageReclaimResult>("/admin/storage/reclaim", { method: "POST" });
}
