import { useCallback, useEffect, useState } from "react";

import { getSettings, reclaimStorage } from "../../api/settings";
import type { PublicSettings, StorageReclaimResult } from "../../api/settings";
import { apiClient } from "../../api/client";
import type { ApiClient } from "../../api/client";

export type SettingsController = {
  error: Error | null;
  isLoading: boolean;
  isReclaiming: boolean;
  reclaim: () => Promise<void>;
  reclaimError: Error | null;
  reclaimResult: StorageReclaimResult | null;
  refresh: () => Promise<void>;
  settings: PublicSettings | null;
};

export function useSettingsController(client: ApiClient = apiClient): SettingsController {
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReclaiming, setIsReclaiming] = useState(false);
  const [reclaimError, setReclaimError] = useState<Error | null>(null);
  const [reclaimResult, setReclaimResult] = useState<StorageReclaimResult | null>(null);
  const [settings, setSettings] = useState<PublicSettings | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      setSettings(await getSettings(client));
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error(String(caught)));
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const reclaim = useCallback(async () => {
    setIsReclaiming(true);
    setReclaimError(null);
    setReclaimResult(null);
    try {
      setReclaimResult(await reclaimStorage(client));
      setSettings(await getSettings(client));
    } catch (caught) {
      setReclaimError(caught instanceof Error ? caught : new Error(String(caught)));
    } finally {
      setIsReclaiming(false);
    }
  }, [client]);

  return {
    error,
    isLoading,
    isReclaiming,
    reclaim,
    reclaimError,
    reclaimResult,
    refresh,
    settings,
  };
}
