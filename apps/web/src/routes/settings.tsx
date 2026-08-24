import { SettingsPage } from "../features/settings/SettingsPage";
import { useSettingsController } from "../features/settings/useSettingsController";

export function SettingsRoute() {
  const settings = useSettingsController();

  return (
    <SettingsPage
      error={settings.error}
      isLoading={settings.isLoading}
      isReclaiming={settings.isReclaiming}
      onReclaim={() => settings.reclaim()}
      onRetry={() => void settings.refresh()}
      reclaimError={settings.reclaimError}
      reclaimResult={settings.reclaimResult}
      settings={settings.settings}
    />
  );
}

export default SettingsRoute;
