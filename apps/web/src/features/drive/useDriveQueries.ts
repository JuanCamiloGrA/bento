import { useCallback, useEffect, useState } from "react";

import type { DriveApi, DriveItemsResponse, DriveSearchResponse } from "../../api/drive";

export type AsyncState<T> = {
  data: T | null;
  error: Error | null;
  loading: boolean;
  refetch: () => Promise<void>;
};

export function useDriveItems(api: DriveApi, folderId: string | null, reloadKey: number): AsyncState<DriveItemsResponse> {
  const [state, setState] = useState<Omit<AsyncState<DriveItemsResponse>, "refetch">>({
    data: null,
    error: null,
    loading: true,
  });

  const refetch = useCallback(async () => {
    setState((current) => ({ ...current, error: null, loading: true }));
    try {
      const data = await api.listItems({ folderId });
      setState({ data, error: null, loading: false });
    } catch (error) {
      setState({ data: null, error: asError(error), loading: false });
    }
  }, [api, folderId]);

  useEffect(() => {
    void refetch();
  }, [refetch, reloadKey]);

  return { ...state, refetch };
}

export function useDriveSearch(
  api: DriveApi,
  folderId: string | null,
  query: string,
  reloadKey: number,
): AsyncState<DriveSearchResponse> {
  const [state, setState] = useState<Omit<AsyncState<DriveSearchResponse>, "refetch">>({
    data: null,
    error: null,
    loading: false,
  });

  const refetch = useCallback(async () => {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      setState({ data: null, error: null, loading: false });
      return;
    }

    setState((current) => ({ ...current, error: null, loading: true }));
    try {
      const data = await api.search({ folderId, query: normalizedQuery });
      setState({ data, error: null, loading: false });
    } catch (error) {
      setState({ data: null, error: asError(error), loading: false });
    }
  }, [api, folderId, query]);

  useEffect(() => {
    void refetch();
  }, [refetch, reloadKey]);

  return { ...state, refetch };
}

function asError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}
