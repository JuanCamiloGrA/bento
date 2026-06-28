import { Input } from "../../components/Input";
import { Select } from "../../components/Select";
import { t } from "../../i18n/dictionary";
import type { SearchResultType } from "../../api/search";
import type { SearchFilters, SearchScope } from "./searchFilters";
import { documentTypeOptions, searchTypeOptions } from "./searchFilters";

export type SearchFiltersBarProps = {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  scope: SearchScope;
};

export function SearchFiltersBar({ filters, onChange, scope }: SearchFiltersBarProps) {
  const typeOptions =
    scope === "documents"
      ? documentTypeOptions.map((option) => ({ label: t(option.labelKey), value: option.value }))
      : searchTypeOptions.map((option) => ({ label: t(option.labelKey), value: option.value }));

  function updateFilter(key: keyof SearchFilters, value: string): void {
    onChange({
      ...filters,
      [key]: key === "type" ? normalizeType(value, scope) : value,
    });
  }

  return (
    <section
      aria-label={t(scope === "documents" ? "documents.filters.label" : "search.filters.label")}
      className="grid gap-3 rounded-app-card border border-app-border bg-app-surface p-3 md:grid-cols-[minmax(12rem,1.2fr)_repeat(4,minmax(8rem,1fr))]"
    >
      <Input
        label={t("search.filter.query")}
        onChange={(event) => updateFilter("q", event.currentTarget.value)}
        placeholder={t("search.filter.queryPlaceholder")}
        type="search"
        value={filters.q}
      />
      <Select
        label={t("search.filter.type")}
        onChange={(event) => updateFilter("type", event.currentTarget.value)}
        options={typeOptions}
        value={filters.type}
      />
      <Input
        label={t("search.filter.folder")}
        onChange={(event) => updateFilter("folderId", event.currentTarget.value)}
        placeholder={t("search.filter.folderPlaceholder")}
        value={filters.folderId}
      />
      <Input
        label={t("search.filter.dateFrom")}
        onChange={(event) => updateFilter("dateFrom", event.currentTarget.value)}
        type="date"
        value={filters.dateFrom}
      />
      <Input
        label={t("search.filter.dateTo")}
        onChange={(event) => updateFilter("dateTo", event.currentTarget.value)}
        type="date"
        value={filters.dateTo}
      />
    </section>
  );
}

function normalizeType(value: string, scope: SearchScope): SearchResultType | "" {
  if (scope === "documents") {
    return value === "pdf_page" ? "pdf_page" : "document";
  }

  return value as SearchResultType | "";
}
