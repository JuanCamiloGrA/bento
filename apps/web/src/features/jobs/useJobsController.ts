import { useCallback, useEffect, useState } from "react";

import { enqueueReindex, listJobs, retryJob } from "../../api/jobs";
import type { JobRecord, JobsListResponse } from "../../api/jobs";
import { apiClient } from "../../api/client";
import type { ApiClient } from "../../api/client";

export type JobsController = {
  error: Error | null;
  isLoading: boolean;
  isReindexing: boolean;
  jobs: JobRecord[];
  refresh: () => Promise<void>;
  reindex: () => Promise<void>;
  retry: (jobId: string) => Promise<void>;
  retryingJobId: string | null;
};

export function useJobsController(client: ApiClient = apiClient): JobsController {
  const [data, setData] = useState<JobsListResponse>({ items: [] });
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReindexing, setIsReindexing] = useState(false);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      setData(await listJobs({ limit: 50 }, client));
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error(String(caught)));
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const nextData = await listJobs({ limit: 50 }, client);

        if (isMounted) {
          setData(nextData);
        }
      } catch (caught) {
        if (isMounted) {
          setError(caught instanceof Error ? caught : new Error(String(caught)));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void load();
    const interval = window.setInterval(() => void load(), 5000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [client]);

  const retry = useCallback(
    async (jobId: string) => {
      setRetryingJobId(jobId);

      try {
        await retryJob(jobId, client);
        await refresh();
      } finally {
        setRetryingJobId(null);
      }
    },
    [client, refresh],
  );

  const reindex = useCallback(async () => {
    setIsReindexing(true);

    try {
      await enqueueReindex(client);
      await refresh();
    } finally {
      setIsReindexing(false);
    }
  }, [client, refresh]);

  return {
    error,
    isLoading,
    isReindexing,
    jobs: data.items,
    refresh,
    reindex,
    retry,
    retryingJobId,
  };
}
