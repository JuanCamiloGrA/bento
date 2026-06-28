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
  failed: "border-app-danger bg-red-50 text-app-danger",
  queued: "border-app-border bg-app-surface-muted text-app-text-muted",
  retrying: "border-app-warning bg-yellow-50 text-app-warning",
  running: "border-app-accent bg-app-accent-muted text-app-accent",
  succeeded: "border-app-success bg-green-50 text-app-success",
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
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-app-text">{t("jobs.header.title")}</h1>
          <p className="mt-1 max-w-3xl text-sm text-app-text-muted">{t("jobs.header.body")}</p>
        </div>
        <Button disabled={isReindexing} onClick={onReindex} variant="primary">
          {isReindexing ? t("jobs.admin.reindexing") : t("jobs.admin.reindex")}
        </Button>
      </header>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div className="rounded-app-card border border-app-border bg-app-surface p-4" key={stat.key}>
            <dt className="text-xs font-medium uppercase text-app-text-muted">{t(stat.key)}</dt>
            <dd className="mt-2 text-2xl font-semibold text-app-text">{stat.value}</dd>
          </div>
        ))}
      </dl>

      {error ? <ErrorState body={t("jobs.error.body")} onRetry={onRetryLoad} /> : null}
      {isLoading ? <LoadingState /> : null}
      {!isLoading && !error && jobs.length === 0 ? (
        <section className="rounded-app-card border border-dashed border-app-border bg-app-surface p-6 text-center">
          <h2 className="text-lg font-semibold text-app-text">{t("jobs.empty.title")}</h2>
          <p className="mt-1 text-sm text-app-text-muted">{t("jobs.empty.body")}</p>
        </section>
      ) : null}
      {!isLoading && jobs.length > 0 ? (
        <div className="overflow-hidden rounded-app-card border border-app-border bg-app-surface">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <caption className="sr-only">{t("jobs.table.caption")}</caption>
              <thead className="border-b border-app-border bg-app-surface-muted text-xs uppercase text-app-text-muted">
                <tr>
                  <th className="px-3 py-3 font-medium" scope="col">
                    {t("jobs.field.type")}
                  </th>
                  <th className="px-3 py-3 font-medium" scope="col">
                    {t("jobs.field.status")}
                  </th>
                  <th className="px-3 py-3 font-medium" scope="col">
                    {t("jobs.field.attempts")}
                  </th>
                  <th className="px-3 py-3 font-medium" scope="col">
                    {t("jobs.field.error")}
                  </th>
                  <th className="px-3 py-3 font-medium" scope="col">
                    {t("jobs.field.created")}
                  </th>
                  <th className="px-3 py-3 font-medium" scope="col">
                    {t("jobs.field.updated")}
                  </th>
                  <th className="px-3 py-3 font-medium" scope="col">
                    <span className="sr-only">{t("common.retry")}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {jobs.map((job) => {
                  const isRetrying = retryingJobId === job.id;

                  return (
                    <tr className="align-top" key={job.id}>
                      <td className="whitespace-nowrap px-3 py-3 font-medium text-app-text">{jobTypeLabel(job.type)}</td>
                      <td className="px-3 py-3">
                        <span
                          className={cx(
                            "inline-flex rounded-app-control border px-2 py-1 text-xs font-medium",
                            jobStatusTone(job.status),
                          )}
                        >
                          {jobStatusLabel(job.status)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-app-text-muted">
                        {job.attempts} / {job.max_attempts}
                      </td>
                      <td className="min-w-52 px-3 py-3 text-app-text-muted">{job.error || t("common.unknown")}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-app-text-muted">{formatDate(job.created_at)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-app-text-muted">{formatDate(job.updated_at)}</td>
                      <td className="px-3 py-3 text-right">
                        {job.status === "failed" ? (
                          <Button
                            aria-label={t("jobs.retry.aria").replace("{id}", job.id)}
                            disabled={isRetrying}
                            onClick={() => onRetry(job.id)}
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
