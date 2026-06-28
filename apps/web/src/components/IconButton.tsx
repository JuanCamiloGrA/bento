import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cx } from "../lib/cx";
import { Tooltip } from "./Tooltip";

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: ReactNode;
  label: string;
};

export function IconButton({ className, icon, label, type = "button", ...props }: IconButtonProps) {
  const button = (
    <button
      aria-label={label}
      className={cx(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-app-control border border-app-border bg-app-surface text-app-text transition-colors duration-150 hover:bg-app-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent disabled:opacity-50",
        className,
      )}
      type={type}
      {...props}
    >
      <span aria-hidden="true" className="text-sm leading-none">
        {icon}
      </span>
    </button>
  );

  return <Tooltip label={label}>{button}</Tooltip>;
}
