import { JobsPage } from "../features/jobs/JobsPage";
import { useJobsController } from "../features/jobs/useJobsController";

export function JobsRoute() {
  const jobs = useJobsController();

  return (
    <JobsPage
      error={jobs.error}
      isLoading={jobs.isLoading}
      isReindexing={jobs.isReindexing}
      jobs={jobs.jobs}
      onReindex={() => void jobs.reindex()}
      onRetry={(jobId) => void jobs.retry(jobId)}
      onRetryLoad={() => void jobs.refresh()}
      retryingJobId={jobs.retryingJobId}
    />
  );
}

export default JobsRoute;
