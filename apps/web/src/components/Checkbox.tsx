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
    <label className="inline-flex min-h-8 items-center gap-2.5 text-sm text-app-text cursor-pointer select-none" htmlFor={checkboxId}>
      <input
        className={cx(
          "h-4.5 w-4.5 rounded border-app-border text-app-accent focus:ring-4 focus:ring-app-accent/10 transition-all duration-200 cursor-pointer",
          className,
        )}
        id={checkboxId}
        type="checkbox"
        {...props}
      />
      <span className="min-w-0 text-app-text/90 font-medium">{label}</span>
    </label>
  );
}
