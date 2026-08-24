import { useState } from "react";
import { Cloud, CloudOff, HardDriveDownload } from "lucide-react";

import { Button } from "../../components/Button";
import { Dialog } from "../../components/Dialog";
import { ErrorState, LoadingState } from "../../components/States";
import type { PublicSettings, ProviderState, StorageReclaimResult, WorkerStatus } from "../../api/settings";
import { t } from "../../i18n/dictionary";
import type { MessageKey } from "../../i18n/dictionary";
import { cx } from "../../lib/cx";

export type SettingsPageProps = {
  error?: Error | null;
  isLoading?: boolean;
  isReclaiming?: boolean;
  onReclaim?: () => Promise<void> | void;
  onRetry?: () => void;
  reclaimError?: Error | null;
  reclaimResult?: StorageReclaimResult | null;
  settings?: PublicSettings | null;
};

type Tone = "danger" | "idle" | "success" | "warning";

type StatusItem = {
  detail?: string;
  label: string;
  tone: Tone;
  value: string;
};

const toneClasses: Record<Tone, string> = {
  danger: "border-red-200 bg-red-50 text-red-750",
  idle: "border-slate-200 bg-app-surface text-app-text",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
};

const providerLabels: Record<string, MessageKey> = {
  disabled: "settings.provider.disabled",
  error: "settings.provider.error",
  pending: "settings.provider.pending",
  ready: "settings.provider.ready",
};

const workerLabels: Record<string, MessageKey> = {
  degraded: "settings.worker.degraded",
  running: "settings.worker.running",
  stopped: "settings.worker.stopped",
};

export function SettingsPage({
  error,
  isLoading = false,
  isReclaiming = false,
  onReclaim,
  onRetry,
  reclaimError,
  reclaimResult,
  settings,
}: SettingsPageProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const items = settings ? settingsItems(settings) : [];
  const maintenance = settings?.storage_maintenance;

  async function confirmReclaim() {
    setConfirmOpen(false);
    await onReclaim?.();
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <header className="flex flex-col gap-1 border-b border-app-border/80 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-app-text">{t("settings.header.title")}</h1>
        <p className="text-sm text-app-text-muted">{t("settings.header.body")}</p>
      </header>

      {error ? <ErrorState body={t("settings.settingsError.body")} onRetry={onRetry} /> : null}
      {isLoading ? <LoadingState /> : null}

      {!isLoading && settings ? (
        <>
          {maintenance ? (
            <section className="overflow-hidden rounded-app-card border border-app-border bg-app-surface shadow-xs" aria-labelledby="cloud-storage-title">
              <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 gap-4">
                  <div className={cx("grid size-11 shrink-0 place-items-center rounded-full", maintenance.connection_state === "connected" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                    {maintenance.connection_state === "connected" ? <Cloud aria-hidden="true" size={22} /> : <CloudOff aria-hidden="true" size={22} />}
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-app-text" id="cloud-storage-title">{t("settings.space.title")}</h2>
                    <p className="mt-1 text-sm text-app-text-muted">{maintenanceDescription(settings)}</p>
                    <p className="mt-2 text-xs font-semibold text-app-text-muted">
                      {t("settings.space.reclaimable")}: {formatBytes(maintenance.reclaimable_bytes)} · {maintenance.reclaimable_files} {t("settings.space.files")}
                    </p>
                  </div>
                </div>
                <Button
                  className="shrink-0"
                  disabled={!maintenance.can_reclaim || isReclaiming}
                  onClick={() => setConfirmOpen(true)}
                  variant="primary"
                >
                  <HardDriveDownload aria-hidden="true" size={17} />
                  {isReclaiming ? t("settings.space.reclaiming") : t("settings.space.action")}
                </Button>
              </div>
              <div className="border-t border-app-border bg-app-surface-muted/50 px-5 py-3 text-xs text-app-text-muted">
                {t("settings.space.localMetadata")}
              </div>
            </section>
          ) : null}

          {reclaimResult ? (
            <p className="rounded-app-control border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" role="status">
              {t("settings.space.success")} {formatBytes(reclaimResult.freed_bytes)}.
            </p>
          ) : null}
          {reclaimError ? (
            <p className="rounded-app-control border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-750" role="alert">
              {t("settings.space.error")}
            </p>
          ) : null}

          <dl className="grid gap-4 md:grid-cols-2">
            {items.map((item) => (
              <div className={cx("rounded-app-card border p-5 shadow-2xs hover:shadow-xs transition-all duration-300", toneClasses[item.tone])} key={item.label}>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-app-text-muted/75">{item.label}</dt>
                <dd className="mt-2 text-lg font-black tracking-tight">{item.value}</dd>
                {item.detail ? <p className="mt-1.5 text-xs text-app-text-muted/80 font-medium">{item.detail}</p> : null}
              </div>
            ))}
          </dl>
        </>
      ) : null}

      <Dialog
        actions={
          <>
            <Button onClick={() => setConfirmOpen(false)}>{t("common.close")}</Button>
            <Button onClick={() => void confirmReclaim()} variant="primary">{t("settings.space.confirm")}</Button>
          </>
        }
        onOpenChange={setConfirmOpen}
        open={confirmOpen}
        title={t("settings.space.dialogTitle")}
      >
        <p>{t("settings.space.dialogBody")}</p>
      </Dialog>
    </div>
  );
}

function maintenanceDescription(settings: PublicSettings): string {
  const maintenance = settings.storage_maintenance;
  if (!maintenance) return "";
  if (maintenance.connection_state === "connected" && maintenance.fully_remote) return t("settings.space.connected");
  if (maintenance.local_blob_count > 0) return t("settings.space.localBlobs");
  if (maintenance.connection_state === "unavailable") return t("settings.space.unavailable");
  return t("settings.space.notConfigured");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length);
  const value = bytes / 1024 ** exponent;
  return `${new Intl.NumberFormat("es", { maximumFractionDigits: value >= 10 ? 1 : 2 }).format(value)} ${units[exponent - 1]}`;
}

export function settingsItems(settings: PublicSettings): StatusItem[] {
  const telegramConfigured = settings.telegram_configured ?? settings.telegram_enabled ?? false;
  const ocrState = providerState(settings.ocr_state, settings.ocr_enabled);
  const embeddingsState = providerState(settings.embeddings_state, settings.embeddings_enabled);
  const workerStatus = settings.worker_status ?? "stopped";

  return [
    {
      label: t("settings.storage"),
      tone: settings.storage_backend === "telegram" ? "warning" : "success",
      value: storageLabel(settings.storage_backend),
    },
    {
      label: t("settings.telegram"),
      tone: telegramConfigured ? "success" : "idle",
      value: telegramConfigured ? t("settings.telegram.configured") : t("settings.telegram.notConfigured"),
    },
    {
      label: t("settings.ocr"),
      tone: providerTone(ocrState),
      value: providerLabel(ocrState),
    },
    {
      label: t("settings.embeddings"),
      tone: providerTone(embeddingsState),
      value: providerLabel(embeddingsState),
    },
    {
      label: t("settings.model"),
      tone: settings.model_available ? "success" : "warning",
      value: settings.model_available ? t("settings.model.available") : t("settings.model.pending"),
    },
    {
      detail:
        typeof settings.worker_concurrency === "number"
          ? `${t("settings.worker.concurrency")}: ${settings.worker_concurrency}`
          : undefined,
      label: t("settings.worker"),
      tone: workerTone(workerStatus),
      value: workerLabel(workerStatus),
    },
    {
      label: t("settings.dataPaths"),
      tone: "idle",
      value: dataPathSummary(settings.data_paths),
    },
  ];
}

function storageLabel(storageBackend: string): string {
  if (storageBackend === "local") {
    return t("settings.storage.local");
  }

  if (storageBackend === "telegram") {
    return t("settings.storage.telegram");
  }

  return storageBackend || t("common.unknown");
}

function providerState(state?: ProviderState, enabled?: boolean): ProviderState {
  if (state) {
    return state;
  }

  return enabled ? "ready" : "disabled";
}

function providerLabel(state: ProviderState): string {
  return t(providerLabels[state] ?? "common.unknown");
}

function providerTone(state: ProviderState): Tone {
  if (state === "ready") {
    return "success";
  }

  if (state === "error") {
    return "danger";
  }

  if (state === "pending") {
    return "warning";
  }

  return "idle";
}

function workerLabel(status: WorkerStatus): string {
  return t(workerLabels[status] ?? "common.unknown");
}

function workerTone(status: WorkerStatus): Tone {
  if (status === "running") {
    return "success";
  }

  if (status === "degraded") {
    return "warning";
  }

  return "idle";
}

function dataPathSummary(paths?: Record<string, string>): string {
  const labels = Object.keys(paths ?? {}).sort();

  return labels.length > 0 ? labels.join(", ") : t("settings.emptyPaths");
}
