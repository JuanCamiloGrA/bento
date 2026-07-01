import type { SelectHTMLAttributes } from "react";
import { useId } from "react";

import { cx } from "../lib/cx";

export type SelectOption = {
  label: string;
  value: string;
};

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: SelectOption[];
};

export function Select({ className, id, label, options, ...props }: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <label className="grid gap-1.5 text-sm text-app-text" htmlFor={selectId}>
      <span className="font-medium text-app-text/90">{label}</span>
      <select
        className={cx(
          "h-10 w-full rounded-app-control border border-app-border bg-app-surface px-3 text-sm text-app-text outline-none transition-all duration-200 focus:border-app-accent focus:ring-4 focus:ring-app-accent/10 disabled:bg-app-surface-muted disabled:opacity-70 focus:shadow-2xs cursor-pointer",
          className,
        )}
        id={selectId}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
