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
    <section className="grid min-h-44 place-items-center rounded-app-card border border-dashed border-app-border bg-app-surface p-6 text-center">
      <div className="max-w-md">
        <h2 className="text-xl font-semibold text-app-text">{title}</h2>
        <p className="mt-2 text-sm text-app-text-muted">{body}</p>
        {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
      </div>
    </section>
  );
}

export type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label = t("common.loading") }: LoadingStateProps) {
  return (
    <div aria-live="polite" className="flex min-h-24 items-center gap-3 text-sm text-app-text-muted" role="status">
      <span
        aria-hidden="true"
        className="h-4 w-4 rounded-full border-2 border-app-border border-t-app-accent"
      />
      <span>{label}</span>
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
      className="rounded-app-card border border-app-danger bg-app-surface p-4 text-sm text-app-text"
      role="alert"
    >
      <h2 className="font-semibold text-app-danger">{title}</h2>
      <p className="mt-1 text-app-text-muted">{body}</p>
      {onRetry ? (
        <div className="mt-3">
          <Button onClick={onRetry} variant="secondary">
            {t("common.retry")}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
