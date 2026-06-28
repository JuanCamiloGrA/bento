import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cx } from "../lib/cx";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-app-accent bg-app-accent text-white hover:bg-teal-800 focus-visible:outline-app-accent",
  secondary:
    "border-app-border bg-app-surface text-app-text hover:bg-app-surface-muted focus-visible:outline-app-accent",
  danger:
    "border-app-danger bg-app-danger text-white hover:bg-red-800 focus-visible:outline-app-danger",
  ghost:
    "border-transparent bg-transparent text-app-text hover:bg-app-surface-muted focus-visible:outline-app-accent",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
};

export function Button({ children, className, type = "button", variant = "secondary", ...props }: ButtonProps) {
  return (
    <button
      className={cx(
        "inline-flex h-9 max-w-full items-center justify-center gap-2 rounded-app-control border px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50",
        variantClasses[variant],
        className,
      )}
      type={type}
      {...props}
    >
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
}
