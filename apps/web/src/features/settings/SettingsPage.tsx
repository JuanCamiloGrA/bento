import { ErrorState, LoadingState } from "../../components/States";
import type { PublicSettings, ProviderState, WorkerStatus } from "../../api/settings";
import { t } from "../../i18n/dictionary";
import type { MessageKey } from "../../i18n/dictionary";
import { cx } from "../../lib/cx";

export type SettingsPageProps = {
  error?: Error | null;
  isLoading?: boolean;
  onRetry?: () => void;
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
  danger: "border-app-danger bg-red-50 text-app-danger",
  idle: "border-app-border bg-app-surface text-app-text",
  success: "border-app-success bg-green-50 text-app-success",
  warning: "border-app-warning bg-yellow-50 text-app-warning",
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

export function SettingsPage({ error, isLoading = false, onRetry, settings }: SettingsPageProps) {
  const items = settings ? settingsItems(settings) : [];

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5">
      <header>
        <h1 className="text-2xl font-semibold text-app-text">{t("settings.header.title")}</h1>
        <p className="mt-1 max-w-3xl text-sm text-app-text-muted">{t("settings.header.body")}</p>
      </header>

      {error ? <ErrorState body={t("settings.settingsError.body")} onRetry={onRetry} /> : null}
      {isLoading ? <LoadingState /> : null}

      {!isLoading && settings ? (
        <dl className="grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <div className={cx("rounded-app-card border p-4", toneClasses[item.tone])} key={item.label}>
              <dt className="text-xs font-medium uppercase text-app-text-muted">{item.label}</dt>
              <dd className="mt-2 text-lg font-semibold">{item.value}</dd>
              {item.detail ? <p className="mt-1 text-sm text-app-text-muted">{item.detail}</p> : null}
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
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
