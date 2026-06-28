import { useEffect, useMemo, useState } from "react";

import type { SearchApi, SearchResponse } from "../../api/search";
import { searchApi } from "../../api/search";
import type { SearchFilters } from "./searchFilters";
import { toSearchRequest } from "./searchFilters";

export type SearchResultsState = {
  data: SearchResponse | null;
  error: Error | null;
  isLoading: boolean;
  refetch: () => void;
};

export function useSearchResults(filters: SearchFilters, client: SearchApi = searchApi): SearchResultsState {
  const request = useMemo(() => toSearchRequest(filters), [filters]);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    client
      .search(request)
      .then((response) => {
        if (!controller.signal.aborted) {
          setData(response);
        }
      })
      .catch((caughtError: unknown) => {
        if (!controller.signal.aborted) {
          setError(caughtError instanceof Error ? caughtError : new Error(String(caughtError)));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [client, refreshToken, request]);

  return {
    data,
    error,
    isLoading,
    refetch: () => setRefreshToken((value) => value + 1),
  };
}
