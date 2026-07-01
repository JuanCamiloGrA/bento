import type { ReactNode } from "react";

import { t } from "../i18n/dictionary";
import { Button } from "./Button";

export type EmptyStateProps = {
  action?: ReactNode;
  body: string;
  title: string;
};

export function EmptyState({ action, body, title }: EmptyStateProps) {
  return (
    <section className="grid min-h-64 place-items-center rounded-app-card border border-dashed border-app-border bg-app-surface p-8 text-center shadow-3xs transition-all duration-200">
      <div className="max-w-md flex flex-col items-center">
        <div className="w-12 h-12 rounded-full bg-slate-50 border border-app-border flex items-center justify-center text-app-text-muted mb-4 shadow-3xs">
          <svg className="w-5.5 h-5.5 opacity-60" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
            <path d="M9 17h6M9 13h6"/>
          </svg>
        </div>
        <h2 className="text-lg font-bold tracking-tight text-app-text">{title}</h2>
        <p className="mt-2 text-sm text-app-text-muted leading-relaxed">{body}</p>
        {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      </div>
    </section>
  );
}

export type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label = t("common.loading") }: LoadingStateProps) {
  return (
    <div aria-live="polite" className="flex min-h-32 flex-col items-center justify-center gap-3 text-sm text-app-text-muted py-6" role="status">
      <span
        aria-hidden="true"
        className="h-6 w-6 rounded-full border-2.5 border-app-border/40 border-t-app-accent animate-spin"
      />
      <span className="font-medium text-app-text-muted/80">{label}</span>
    </div>
  );
}

export type ErrorStateProps = {
  body: string;
  onRetry?: () => void;
  title?: string;
};

export function ErrorState({ body, onRetry, title = t("common.error") }: ErrorStateProps) {
  return (
    <section
      aria-live="assertive"
      className="rounded-app-card border border-red-200 bg-red-50/50 p-5 text-sm text-app-text flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-3xs transition-all duration-200"
      role="alert"
    >
      <div className="flex gap-3">
        <div className="w-5 h-5 shrink-0 rounded-full bg-red-100 flex items-center justify-center text-red-600 mt-0.5">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <div>
          <h2 className="font-bold text-red-800 tracking-tight">{title}</h2>
          <p className="mt-1 text-red-750/90 leading-relaxed">{body}</p>
        </div>
      </div>
      {onRetry ? (
        <div className="shrink-0 self-start sm:self-center">
          <Button onClick={onRetry} variant="secondary" className="border-red-200 hover:bg-red-100/50 text-red-800 active:bg-red-100 h-9.5">
            {t("common.retry")}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
