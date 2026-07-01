import type { InputHTMLAttributes } from "react";
import { useId } from "react";

import { cx } from "../lib/cx";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export function Input({ className, hint, id, label, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;

  return (
    <label className="grid gap-1.5 text-sm text-app-text" htmlFor={inputId}>
      <span className="font-medium text-app-text/90">{label}</span>
      <input
        aria-describedby={hintId}
        className={cx(
          "h-10 w-full rounded-app-control border border-app-border bg-app-surface px-3 text-sm text-app-text outline-none transition-all duration-200 placeholder:text-app-text-muted/65 focus:border-app-accent focus:ring-4 focus:ring-app-accent/10 disabled:bg-app-surface-muted disabled:opacity-70 focus:shadow-2xs",
          className,
        )}
        id={inputId}
        {...props}
      />
      {hint ? (
        <span className="text-xs text-app-text-muted" id={hintId}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}
