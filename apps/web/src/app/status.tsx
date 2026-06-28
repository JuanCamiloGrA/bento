import { StatusIndicator } from "../components/StatusIndicator";
import type { StatusTone } from "../components/StatusIndicator";
import type { JobRecord } from "../api/jobs";
import { useJobsController } from "../features/jobs/useJobsController";
import { t } from "../i18n/dictionary";

export type JobStatusSummary = {
  active: number;
  failed: number;
  label: string;
  pending: number;
  tone: StatusTone;
};

export type GlobalJobStatusIndicatorProps = {
  jobs: JobRecord[];
};

export function ConnectedGlobalJobStatusIndicator() {
  const jobs = useJobsController();

  return <GlobalJobStatusIndicator jobs={jobs.jobs} />;
}

export function GlobalJobStatusIndicator({ jobs }: GlobalJobStatusIndicatorProps) {
  const summary = summarizeJobStatus(jobs);
  const detail = t("status.summary")
    .replace("{active}", String(summary.active))
    .replace("{pending}", String(summary.pending))
    .replace("{failed}", String(summary.failed));

  return (
    <div aria-live="polite" role="status">
      <StatusIndicator detail={detail} label={summary.label} tone={summary.tone} />
    </div>
  );
}

export function summarizeJobStatus(jobs: JobRecord[]): JobStatusSummary {
  const active = jobs.filter((job) => job.status === "running").length;
  const pending = jobs.filter((job) => job.status === "queued" || job.status === "retrying").length;
  const failed = jobs.filter((job) => job.status === "failed").length;

  if (failed > 0) {
    return {
      active,
      failed,
      label: `${failed} ${t("status.failed")}`,
      pending,
      tone: "danger",
    };
  }

  if (active > 0) {
    return {
      active,
      failed,
      label: `${active} ${t("status.active")}`,
      pending,
      tone: "warning",
    };
  }

  if (pending > 0) {
    return {
      active,
      failed,
      label: `${pending} ${t("status.pending")}`,
      pending,
      tone: "warning",
    };
  }

  return {
    active,
    failed,
    label: t("status.idle"),
    pending,
    tone: "success",
  };
}
