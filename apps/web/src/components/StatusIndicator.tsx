import { t } from "../i18n/dictionary";
import { cx } from "../lib/cx";

export type StatusTone = "idle" | "success" | "warning" | "danger";

const toneClasses: Record<StatusTone, string> = {
  danger: "bg-app-danger animate-pulse shadow-sm shadow-app-danger/35",
  idle: "bg-slate-400",
  success: "bg-app-success shadow-sm shadow-app-success/35",
  warning: "bg-app-warning animate-pulse shadow-sm shadow-app-warning/35",
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
      className="flex min-h-10 items-center gap-2.5 border-t border-app-border bg-app-surface px-6 py-2.5 text-xs text-app-text-muted select-none"
    >
      <span aria-hidden="true" className={cx("h-2.5 w-2.5 rounded-full", toneClasses[tone])} />
      <span className="font-semibold text-app-text/90">{label}</span>
      <span className="hidden truncate text-app-text-muted/80 sm:inline">— {detail}</span>
    </aside>
  );
}
