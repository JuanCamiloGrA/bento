import { apiClient } from "./client";
import type { ApiClient } from "./client";

export type StorageBackend = "local" | "telegram" | string;
export type ProviderState = "disabled" | "pending" | "ready" | "error" | string;
export type WorkerStatus = "stopped" | "running" | "degraded" | string;
export type TelegramConnectionState = "connected" | "unavailable" | "not_configured" | string;
export type SettingType = "boolean" | "choice" | "integer" | "number" | "path" | "secret" | "string";
export type SettingSource = "default" | "saved" | "environment" | "policy";
export type ApplyMode = "live" | "restart_worker" | "restart_services" | "restart_app";

export type StorageMaintenanceStatus = { can_reclaim: boolean; connection_state: TelegramConnectionState; fully_remote: boolean; local_blob_count: number; reclaimable_bytes: number; reclaimable_files: number; telegram_blob_count: number };
export type StorageReclaimResult = { deleted_files: number; freed_bytes: number; retained_bytes: number; retained_files: number; skipped_recent_files: number };
export type PublicSettings = { data_paths?: Record<string, string>; embeddings_enabled?: boolean; embeddings_state?: ProviderState; model_available?: boolean; ocr_enabled?: boolean; ocr_state?: ProviderState; storage_backend: StorageBackend; storage_maintenance?: StorageMaintenanceStatus; telegram_configured?: boolean; telegram_enabled?: boolean; worker_concurrency?: number; worker_status?: WorkerStatus };

export type SettingConstraints = { choices: string[]; maximum: number | null; minimum: number | null };
export type SettingDefinition = { apply_mode: ApplyMode; availability: "both" | "desktop" | "headless"; constraints: SettingConstraints; default: unknown; editable: boolean; env_aliases: string[]; group: "general" | "storage" | "telegram" | "ai" | "performance" | "advanced" | string; help_key: string; key: string; label_key: string; locked: boolean; probe: string | null; secret: boolean; source: SettingSource; type: SettingType };
export type SettingsSchema = { fields: SettingDefinition[]; revision: number };
export type SettingValue = { apply_mode: ApplyMode; configured?: boolean; locked: boolean; source: SettingSource; value?: unknown };
export type SettingsValues = { revision: number; values: Record<string, SettingValue> };
export type SecretReferenceMutation = { configured: boolean; reference: string | null };
export type SettingsDraft = { run_probes?: boolean; secret_references?: Record<string, SecretReferenceMutation>; values: Record<string, unknown> };
export type FieldIssue = { code: string; key: string; message: string };
export type ProbeResult = { key: string; message: string | null; status: string };
export type RestartPlan = { affected_keys: string[]; mode: ApplyMode; services: string[] };
export type SettingsValidation = { errors: FieldIssue[]; probes: ProbeResult[]; restart_plan: RestartPlan; valid: boolean; warnings: FieldIssue[] };
export type SettingsPatch = SettingsDraft & { revision: number };
export type SettingsPatchResult = SettingsValues & { restart_plan: RestartPlan };
export type SettingsImportEntry = { key: string; secret?: boolean; source?: string; value?: unknown };
export type SettingsImportPreview = { errors?: FieldIssue[]; items?: (SettingsImportEntry & { configured?: boolean; env_key?: string; locked?: boolean; status?: string })[]; known?: SettingsImportEntry[]; revision?: number; secret_keys?: string[]; unknown?: string[]; unknown_keys?: string[]; values?: Record<string, unknown>; [key: string]: unknown };
export type SettingsExport = Record<string, unknown>;

export function getSettings(client: ApiClient = apiClient): Promise<PublicSettings> { return client.request<PublicSettings>("/settings"); }
export function getSettingsSchema(client: ApiClient = apiClient): Promise<SettingsSchema> { return client.request<SettingsSchema>("/settings/schema"); }
export function getSettingsValues(client: ApiClient = apiClient): Promise<SettingsValues> { return client.request<SettingsValues>("/settings/values"); }
export function validateSettings(draft: SettingsDraft, client: ApiClient = apiClient): Promise<SettingsValidation> { return client.request<SettingsValidation>("/settings/validate", { body: draft, method: "POST" }); }
export function patchSettings(patch: SettingsPatch, client: ApiClient = apiClient): Promise<SettingsPatchResult> { return client.request<SettingsPatchResult>("/settings/values", { body: patch, method: "PATCH" }); }
export function previewSettingsImport(content: string, client: ApiClient = apiClient): Promise<SettingsImportPreview> { return client.request<SettingsImportPreview>("/settings/import/preview", { body: { content }, method: "POST" }); }
export function exportSettings(client: ApiClient = apiClient): Promise<SettingsExport> { return client.request<SettingsExport>("/settings/export"); }
export function reclaimStorage(client: ApiClient = apiClient): Promise<StorageReclaimResult> { return client.request<StorageReclaimResult>("/admin/storage/reclaim", { method: "POST" }); }
