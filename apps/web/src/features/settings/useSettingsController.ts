import { useCallback, useEffect, useState } from "react";

import { getSettings } from "../../api/settings";
import type { PublicSettings } from "../../api/settings";
import { apiClient } from "../../api/client";
import type { ApiClient } from "../../api/client";

export type SettingsController = {
  error: Error | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  settings: PublicSettings | null;
};

export function useSettingsController(client: ApiClient = apiClient): SettingsController {
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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

  return {
    error,
    isLoading,
    refresh,
    settings,
  };
}
