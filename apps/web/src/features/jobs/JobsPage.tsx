import { Button } from "../../components/Button";
import { ErrorState, LoadingState } from "../../components/States";
import type { JobRecord, JobStatus, JobType } from "../../api/jobs";
import { t } from "../../i18n/dictionary";
import type { MessageKey } from "../../i18n/dictionary";
import { cx } from "../../lib/cx";

export type JobsPageProps = {
  error?: Error | null;
  isLoading?: boolean;
  isReindexing?: boolean;
  jobs: JobRecord[];
  onReindex: () => void;
  onRetry: (jobId: string) => void;
  onRetryLoad?: () => void;
  retryingJobId?: string | null;
};

type JobStat = {
  key: MessageKey;
  value: number;
};

const statusToneClasses: Record<JobStatus, string> = {
  failed: "border-red-200 bg-red-50 text-red-700",
  queued: "border-slate-200 bg-slate-50 text-slate-600",
  retrying: "border-amber-200 bg-amber-50 text-amber-700",
  running: "border-teal-200 bg-teal-50 text-teal-800 font-semibold animate-pulse",
  succeeded: "border-emerald-250 bg-emerald-50 text-emerald-700",
};

const statusLabels: Record<JobStatus, MessageKey> = {
  failed: "jobs.status.failed",
  queued: "jobs.status.queued",
  retrying: "jobs.status.retrying",
  running: "jobs.status.running",
  succeeded: "jobs.status.succeeded",
};

const typeLabels: Record<JobType, MessageKey> = {
  embedding: "jobs.type.embedding",
  journal_export: "jobs.type.journal_export",
  metadata: "jobs.type.metadata",
  ocr: "jobs.type.ocr",
  pdf_thumbnail: "jobs.type.pdf_thumbnail",
  reindex: "jobs.type.reindex",
  telegram_import: "jobs.type.telegram_import",
  thumbnail: "jobs.type.thumbnail",
  video_thumbnail: "jobs.type.video_thumbnail",
};

export function JobsPage({
  error,
  isLoading = false,
  isReindexing = false,
  jobs,
  onReindex,
  onRetry,
  onRetryLoad,
  retryingJobId,
}: JobsPageProps) {
  const stats = jobStats(jobs);

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-app-border/80 pb-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-app-text">{t("jobs.header.title")}</h1>
          <p className="mt-1 max-w-3xl text-sm text-app-text-muted">{t("jobs.header.body")}</p>
        </div>
        <Button disabled={isReindexing} onClick={onReindex} variant="primary" className="cursor-pointer font-semibold shadow-sm">
          {isReindexing ? t("jobs.admin.reindexing") : t("jobs.admin.reindex")}
        </Button>
      </header>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div className="rounded-app-card border border-app-border bg-app-surface p-5 shadow-2xs hover:shadow-sm transition-all duration-200" key={stat.key}>
            <dt className="text-[10px] font-bold uppercase tracking-wider text-app-text-muted/80">{t(stat.key)}</dt>
            <dd className="mt-2 text-3xl font-black tracking-tight text-app-text">{stat.value}</dd>
          </div>
        ))}
      </dl>

      {error ? <ErrorState body={t("jobs.error.body")} onRetry={onRetryLoad} /> : null}
      {isLoading ? <LoadingState /> : null}
      {!isLoading && !error && jobs.length === 0 ? (
        <section className="rounded-app-card border border-dashed border-app-border bg-app-surface p-8 text-center shadow-3xs">
          <h2 className="text-lg font-bold tracking-tight text-app-text">{t("jobs.empty.title")}</h2>
          <p className="mt-2 text-sm text-app-text-muted">{t("jobs.empty.body")}</p>
        </section>
      ) : null}
      {!isLoading && jobs.length > 0 ? (
        <div className="overflow-hidden rounded-app-card border border-app-border bg-app-surface shadow-2xs">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <caption className="sr-only">{t("jobs.table.caption")}</caption>
              <thead className="border-b border-app-border bg-app-surface-muted text-[10px] font-bold uppercase tracking-wider text-app-text-muted/80 select-none">
                <tr>
                  <th className="px-4 py-3.5 font-bold" scope="col">
                    {t("jobs.field.type")}
                  </th>
                  <th className="px-4 py-3.5 font-bold" scope="col">
                    {t("jobs.field.status")}
                  </th>
                  <th className="px-4 py-3.5 font-bold" scope="col">
                    {t("jobs.field.attempts")}
                  </th>
                  <th className="px-4 py-3.5 font-bold" scope="col">
                    {t("jobs.field.error")}
                  </th>
                  <th className="px-4 py-3.5 font-bold" scope="col">
                    {t("jobs.field.created")}
                  </th>
                  <th className="px-4 py-3.5 font-bold" scope="col">
                    {t("jobs.field.updated")}
                  </th>
                  <th className="px-4 py-3.5 font-bold" scope="col">
                    <span className="sr-only">{t("common.retry")}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {jobs.map((job) => {
                  const isRetrying = retryingJobId === job.id;

                  return (
                    <tr className="align-middle hover:bg-slate-50/50 transition-colors" key={job.id}>
                      <td className="whitespace-nowrap px-4 py-3.5 font-semibold text-app-text">{jobTypeLabel(job.type)}</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={cx(
                            "inline-flex rounded-app-control border px-2 py-0.5 text-[9px] uppercase font-bold tracking-wider select-none",
                            jobStatusTone(job.status),
                          )}
                        >
                          {jobStatusLabel(job.status)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-app-text-muted font-medium">
                        {job.attempts} <span className="opacity-40">/</span> {job.max_attempts}
                      </td>
                      <td className="min-w-52 px-4 py-3.5 text-xs text-app-text-muted leading-relaxed font-medium">{job.error || t("common.unknown")}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-app-text-muted">{formatDate(job.created_at)}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-app-text-muted">{formatDate(job.updated_at)}</td>
                      <td className="px-4 py-3.5 text-right">
                        {job.status === "failed" ? (
                          <Button
                            aria-label={t("jobs.retry.aria").replace("{id}", job.id)}
                            disabled={isRetrying}
                            onClick={() => onRetry(job.id)}
                            className="h-8.5 px-3 text-xs font-semibold shadow-2xs"
                          >
                            {isRetrying ? t("jobs.retry.pending") : t("common.retry")}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function jobStats(jobs: JobRecord[]): JobStat[] {
  return [
    { key: "jobs.stats.running", value: jobs.filter((job) => job.status === "running").length },
    { key: "jobs.stats.pending", value: jobs.filter((job) => job.status === "queued" || job.status === "retrying").length },
    { key: "jobs.stats.failed", value: jobs.filter((job) => job.status === "failed").length },
    { key: "jobs.stats.succeeded", value: jobs.filter((job) => job.status === "succeeded").length },
  ];
}

function jobStatusLabel(status: JobStatus): string {
  return t(statusLabels[status] ?? "common.unknown");
}

function jobStatusTone(status: JobStatus): string {
  return statusToneClasses[status] ?? "border-app-border bg-app-surface-muted text-app-text-muted";
}

function jobTypeLabel(type: JobType): string {
  return t(typeLabels[type] ?? "common.unknown");
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return t("common.unknown");
  }

  return new Intl.DateTimeFormat(t("app.locale"), {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
