import { useId } from "react";
import type { ReactElement } from "react";

import { cx } from "../lib/cx";

export type TooltipProps = {
  children: ReactElement;
  label: string;
  side?: "top" | "bottom";
};

export function Tooltip({ children, label, side = "top" }: TooltipProps) {
  const id = useId();

  return (
    <span className="group relative inline-flex">
      {children}
      <span
        className={cx(
          "pointer-events-none absolute left-1/2 z-30 w-max max-w-56 -translate-x-1/2 rounded-app-control border border-app-border bg-app-surface px-2 py-1 text-xs text-app-text opacity-0 shadow-app-dialog transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100",
          side === "top" ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]",
        )}
        id={id}
        role="tooltip"
      >
        {label}
      </span>
    </span>
  );
}
