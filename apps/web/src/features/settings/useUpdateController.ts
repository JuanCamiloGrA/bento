import { useCallback, useEffect, useMemo, useState } from "react";

import { desktopBridge } from "../../api/settingsDesktop";
import type { DesktopPlatform, UpdateState } from "../../api/settingsDesktop";

export type UpdateController = {
  check: () => Promise<void>;
  download: () => Promise<void>;
  install: () => Promise<void>;
  state: UpdateState;
  supported: boolean;
};

export function useUpdateController(desktop: DesktopPlatform): UpdateController {
  const updater = desktopBridge()?.updates;
  const [state, setState] = useState<UpdateState>({
    currentVersion: desktop.version,
    installMode: "unsupported",
    status: "idle",
  });

  useEffect(() => {
    if (!updater) return;
    let active = true;
    const unsubscribe = updater.onState((next) => {
      if (active) setState(next);
    });
    void updater.getState().then((next) => {
      if (active) setState(next);
    }).catch(() => {
      if (active) setState((current) => ({ ...current, error: { code: "state_unavailable" }, status: "error" }));
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [updater]);

  const check = useCallback(async () => {
    if (!updater) return;
    try {
      setState((current) => ({ ...current, error: undefined, status: "checking" }));
      setState(await updater.check());
    } catch {
      try { setState(await updater.getState()); }
      catch { setState((current) => ({ ...current, error: { code: "check_failed" }, status: "error" })); }
    }
  }, [updater]);

  const download = useCallback(async () => {
    if (!updater) return;
    try {
      setState(await updater.download());
    } catch {
      try { setState(await updater.getState()); }
      catch { setState((current) => ({ ...current, error: { code: "download_failed" }, status: "error" })); }
    }
  }, [updater]);

  const install = useCallback(async () => {
    if (state.status !== "downloaded" || !updater) return;
    try {
      setState((current) => ({ ...current, status: "installing" }));
      const result = await updater.install();
      if (result.action === "manual") setState((current) => ({ ...current, status: "downloaded" }));
    } catch {
      try { setState(await updater.getState()); }
      catch { setState((current) => ({ ...current, error: { code: "install_failed" }, status: "error" })); }
    }
  }, [state.status, updater]);

  return useMemo(() => ({ check, download, install, state, supported: Boolean(updater) }), [check, download, install, state, updater]);
}
