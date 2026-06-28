import { t } from "../i18n/dictionary";
import { cx } from "../lib/cx";

export type StatusTone = "idle" | "success" | "warning" | "danger";

const toneClasses: Record<StatusTone, string> = {
  danger: "bg-app-danger",
  idle: "bg-app-text-muted",
  success: "bg-app-success",
  warning: "bg-app-warning",
};

export type StatusIndicatorProps = {
  detail?: string;
  label?: string;
  tone?: StatusTone;
};

export function StatusIndicator({
  detail = t("app.status.detail"),
  label = t("app.status.idle"),
  tone = "idle",
}: StatusIndicatorProps) {
  return (
    <aside
      aria-label={t("shell.statusLabel")}
      className="flex min-h-10 items-center gap-2 border-t border-app-border bg-app-surface px-4 py-2 text-xs text-app-text-muted"
    >
      <span aria-hidden="true" className={cx("h-2 w-2 rounded-full", toneClasses[tone])} />
      <span className="font-medium text-app-text">{label}</span>
      <span className="hidden truncate sm:inline">{detail}</span>
    </aside>
  );
}
