import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cx } from "../lib/cx";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-app-accent bg-app-accent text-white hover:bg-teal-700 active:bg-teal-800 shadow-sm transition-all focus-visible:outline-app-accent",
  secondary:
    "border-app-border bg-app-surface text-app-text hover:bg-slate-50 hover:text-app-text hover:border-slate-300 active:bg-slate-100 shadow-2xs transition-all focus-visible:outline-app-accent",
  danger:
    "border-app-danger bg-app-danger text-white hover:bg-red-600 active:bg-red-700 shadow-sm transition-all focus-visible:outline-app-danger",
  ghost:
    "border-transparent bg-transparent text-app-text hover:bg-app-surface-muted active:bg-app-surface-muted/80 transition-all focus-visible:outline-app-accent",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
};

export function Button({ children, className, type = "button", variant = "secondary", ...props }: ButtonProps) {
  return (
    <button
      className={cx(
        "inline-flex h-10 max-w-full items-center justify-center gap-2 rounded-app-control border px-4 text-sm font-medium transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 cursor-pointer",
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
