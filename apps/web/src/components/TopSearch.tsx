import { useEffect, useRef } from "react";

import { t } from "../i18n/dictionary";

export type TopSearchProps = {
  onSubmit: (query: string) => void;
};

export function TopSearch({ onSubmit }: TopSearchProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <form
      aria-label={t("search.label")}
      className="relative flex min-w-0 flex-1 items-center"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        onSubmit(String(formData.get("q") ?? ""));
      }}
      role="search"
    >
      <div className="relative w-full flex items-center">
        <span className="absolute left-3 text-app-text-muted pointer-events-none">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.3-4.3"/>
          </svg>
        </span>
        <input
          aria-label={t("search.label")}
          className="h-10 w-full rounded-app-control border border-app-border bg-app-surface pl-9 pr-16 text-sm text-app-text outline-none transition-all duration-200 placeholder:text-app-text-muted focus:border-app-accent focus:ring-4 focus:ring-app-accent/10 focus:shadow-sm"
          name="q"
          placeholder={t("search.placeholder")}
          ref={inputRef}
          type="search"
        />
        <div className="absolute right-2.5 flex items-center gap-1.5 pointer-events-none">
          <kbd className="hidden h-5.5 items-center rounded border border-app-border bg-app-surface-muted px-1.5 text-[10px] font-semibold text-app-text-muted/80 sm:inline-flex">
            {t("search.shortcut")}
          </kbd>
        </div>
      </div>
    </form>
  );
}
