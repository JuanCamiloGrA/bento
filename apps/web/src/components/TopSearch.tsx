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
      className="flex min-w-0 flex-1 items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        onSubmit(String(formData.get("q") ?? ""));
      }}
      role="search"
    >
      <label className="min-w-0 flex-1">
        <span className="sr-only">{t("search.label")}</span>
        <input
          aria-label={t("search.label")}
          className="h-9 w-full rounded-app-control border border-app-border bg-app-surface px-3 text-sm text-app-text outline-none transition-colors duration-150 placeholder:text-app-text-muted focus:border-app-accent focus:ring-2 focus:ring-app-accent/20"
          name="q"
          placeholder={t("search.placeholder")}
          ref={inputRef}
          type="search"
        />
      </label>
      <kbd className="hidden h-6 items-center rounded border border-app-border bg-app-surface-muted px-2 text-xs text-app-text-muted sm:inline-flex">
        {t("search.shortcut")}
      </kbd>
    </form>
  );
}
