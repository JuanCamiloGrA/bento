import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { cx } from "../lib/cx";

export type MenuItem = {
  disabled?: boolean;
  id: string;
  label: string;
  onSelect: () => void;
};

export type MenuProps = {
  items: MenuItem[];
  label: string;
  trigger: ReactNode;
};

export function Menu({ items, label, trigger }: MenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const closeMenu = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const firstEnabledItem = menuRef.current?.querySelector<HTMLButtonElement>(
      'button[role="menuitem"]:not(:disabled)',
    );
    firstEnabledItem?.focus();

    function onDocumentClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node) && !triggerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
      }
    }

    document.addEventListener("mousedown", onDocumentClick);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeMenu, open]);

  return (
    <div className="relative inline-flex">
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className="inline-flex h-8 items-center rounded-app-control border border-app-border bg-app-surface px-2 text-sm text-app-text transition-colors duration-150 hover:bg-app-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent"
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        type="button"
      >
        {trigger}
      </button>
      {open ? (
        <div
          aria-label={label}
          className="absolute right-0 top-[calc(100%+6px)] z-20 min-w-44 rounded-app-card border border-app-border bg-app-surface p-1 shadow-app-dialog"
          ref={menuRef}
          role="menu"
        >
          {items.map((item) => (
            <button
              className={cx(
                "flex h-8 w-full items-center rounded-app-control px-2 text-left text-sm text-app-text transition-colors duration-150 hover:bg-app-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-app-accent disabled:text-app-text-muted",
              )}
              disabled={item.disabled}
              key={item.id}
              onClick={() => {
                item.onSelect();
                closeMenu();
              }}
              role="menuitem"
              type="button"
            >
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
