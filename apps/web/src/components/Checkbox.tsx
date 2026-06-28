import type { InputHTMLAttributes } from "react";
import { useId } from "react";

import { cx } from "../lib/cx";

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
};

export function Checkbox({ className, id, label, ...props }: CheckboxProps) {
  const generatedId = useId();
  const checkboxId = id ?? generatedId;

  return (
    <label className="inline-flex min-h-8 items-center gap-2 text-sm text-app-text" htmlFor={checkboxId}>
      <input
        className={cx(
          "h-4 w-4 rounded border-app-border text-app-accent focus:ring-2 focus:ring-app-accent/30 focus:ring-offset-1",
          className,
        )}
        id={checkboxId}
        type="checkbox"
        {...props}
      />
      <span className="min-w-0">{label}</span>
    </label>
  );
}
