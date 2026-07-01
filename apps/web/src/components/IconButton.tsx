import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cx } from "../lib/cx";
import { Tooltip } from "./Tooltip";

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: ReactNode;
  label: string;
};

export function IconButton({ className, icon, label, type = "button", ...props }: IconButtonProps) {
  let renderedIcon = icon;
  if (typeof icon === "string") {
    const trimmed = icon.trim();
    if (trimmed === "*") {
      renderedIcon = (
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="text-amber-500">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      );
    } else if (trimmed === "+") {
      renderedIcon = (
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-app-text-muted hover:text-app-text">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
    } else if (trimmed === "<") {
      renderedIcon = (
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
      );
    } else if (trimmed === ">") {
      renderedIcon = (
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 18 6-6-6-6" />
        </svg>
      );
    } else if (trimmed.toLowerCase() === "x" || trimmed === "✕") {
      renderedIcon = (
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      );
    } else if (trimmed === "S") {
      renderedIcon = (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
          <path d="M16 3h5v5" />
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
          <path d="M8 21H3v-5" />
        </svg>
      );
    }
  }

  const button = (
    <button
      aria-label={label}
      className={cx(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-app-control border border-app-border bg-app-surface text-app-text transition-all duration-200 hover:bg-app-surface-muted hover:text-app-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent disabled:opacity-50 shadow-2xs cursor-pointer",
        className,
      )}
      type={type}
      {...props}
    >
      <span aria-hidden="true" className="flex items-center justify-center leading-none">
        {renderedIcon}
      </span>
    </button>
  );

  return <Tooltip label={label}>{button}</Tooltip>;
}
