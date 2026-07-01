import { useMemo, useState } from "react";

import { ErrorState, EmptyState, LoadingState } from "../../components/States";
import type { SearchApi } from "../../api/search";
import { t } from "../../i18n/dictionary";
import { SearchFiltersBar } from "./SearchFiltersBar";
import { SearchResultsList } from "./SearchResultsList";
import type { SearchFilters, SearchScope } from "./searchFilters";
import { parseSearchFilters, toUrlSearch } from "./searchFilters";
import { useSearchResults } from "./useSearchResults";

export type SearchViewProps = {
  client?: SearchApi;
  scope?: SearchScope;
};

export function SearchView({ client, scope = "global" }: SearchViewProps) {
  const initialFilters = useMemo(() => parseSearchFilters(window.location.search, scope), [scope]);
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const results = useSearchResults(filters, client);
  const title = scope === "documents" ? t("documents.title") : t("search.title");
  const body = scope === "documents" ? t("documents.subtitle") : t("search.subtitle");

  function updateFilters(nextFilters: SearchFilters): void {
    setFilters(nextFilters);
    const nextSearch = toUrlSearch(nextFilters);
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`;
    window.history.pushState({}, "", nextUrl);
  }

  return (
    <div className="grid w-full gap-5">
      <header className="flex flex-col gap-1 border-b border-app-border/80 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-app-text">{title}</h1>
        <p className="text-sm text-app-text-muted">{body}</p>
      </header>

      <SearchFiltersBar filters={filters} onChange={updateFilters} scope={scope} />

      {results.isLoading ? <LoadingState label={t("search.loading")} /> : null}
      {results.error ? <ErrorState body={t("search.error")} onRetry={results.refetch} /> : null}
      {!results.isLoading && !results.error && results.data?.items.length === 0 ? (
        <EmptyState body={t("search.empty.body")} title={t("search.empty.title")} />
      ) : null}
      {!results.error && results.data && results.data.items.length > 0 ? (
        <SearchResultsList items={results.data.items} />
      ) : null}
    </div>
  );
}
