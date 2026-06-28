import { SettingsPage } from "../features/settings/SettingsPage";
import { useSettingsController } from "../features/settings/useSettingsController";

export function SettingsRoute() {
  const settings = useSettingsController();

  return (
    <SettingsPage
      error={settings.error}
      isLoading={settings.isLoading}
      onRetry={() => void settings.refresh()}
      settings={settings.settings}
    />
  );
}

export default SettingsRoute;
