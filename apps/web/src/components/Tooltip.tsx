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
          "pointer-events-none absolute left-1/2 z-30 w-max max-w-56 -translate-x-1/2 rounded-app-control border border-slate-950 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-50 opacity-0 shadow-md transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100",
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
