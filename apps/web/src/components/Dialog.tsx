import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";

import { t } from "../i18n/dictionary";
import { Button } from "./Button";

const focusableSelector = [
  "a[href]",
  "button:not(:disabled)",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export type DialogProps = {
  actions?: ReactNode;
  children: ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
};

export function Dialog({ actions, children, onOpenChange, open, title }: DialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    returnFocusRef.current = document.activeElement as HTMLElement | null;

    const focusable = getFocusable(panelRef.current);
    (focusable[0] ?? panelRef.current)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
      }

      if (event.key === "Tab") {
        trapFocus(event, panelRef.current);
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [onOpenChange, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/30 p-4" role="presentation">
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="max-h-[min(80vh,42rem)] w-full max-w-lg overflow-auto rounded-app-card border border-app-border bg-app-surface p-4 text-app-text shadow-app-dialog"
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold" id={titleId}>
            {title}
          </h2>
          <Button aria-label={t("common.close")} onClick={() => onOpenChange(false)} variant="ghost">
            {t("common.close")}
          </Button>
        </div>
        <div className="mt-3 text-sm text-app-text-muted">{children}</div>
        {actions ? <div className="mt-4 flex justify-end gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

function getFocusable(root: HTMLElement | null): HTMLElement[] {
  if (!root) {
    return [];
  }

  return Array.from(root.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => !element.hasAttribute("disabled") && element.tabIndex !== -1,
  );
}

function trapFocus(event: KeyboardEvent, root: HTMLElement | null) {
  const focusable = getFocusable(root);

  if (focusable.length === 0) {
    event.preventDefault();
    root?.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
