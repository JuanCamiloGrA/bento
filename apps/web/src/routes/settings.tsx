import { SettingsPage } from "../features/settings/SettingsPage";
import { useSettingsController } from "../features/settings/useSettingsController";

export function SettingsRoute() {
  const settings = useSettingsController();
  return <SettingsPage controller={settings} />;
}

export default SettingsRoute;
