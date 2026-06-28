import { Thumbnail } from "../../components/Thumbnail";
import { VirtualList } from "../../components/VirtualList";
import type { SearchHit, SearchProcessingState, SearchResultType } from "../../api/search";
import { t } from "../../i18n/dictionary";
import type { MessageKey } from "../../i18n/dictionary";
import { groupSearchHits } from "./searchFilters";

export type SearchResultsListProps = {
  items: SearchHit[];
};

const typeLabels: Record<SearchResultType, MessageKey> = {
  album: "search.type.album",
  asset: "search.type.asset",
  document: "search.type.document",
  folder: "search.type.folder",
  ocr_block: "search.type.ocr_block",
  pdf_page: "search.type.pdf_page",
  photo: "search.type.photo",
  video: "search.type.video",
};

const stateLabels: Record<SearchProcessingState, MessageKey> = {
  disabled: "search.state.disabled",
  failed: "search.state.failed",
  indexed: "search.state.indexed",
  indexing: "search.state.indexing",
  partial: "search.state.partial",
  pending: "search.state.pending",
};

export function SearchResultsList({ items }: SearchResultsListProps) {
  const groups = groupSearchHits(items);

  return (
    <div className="grid gap-4" role="list" aria-label={t("search.results.label")}>
      {groups.map((group) => (
        <section aria-labelledby={`search-group-${group.type}`} className="grid gap-2" key={group.type}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-app-text" id={`search-group-${group.type}`}>
              {t(typeLabels[group.type])}
            </h2>
            <span className="text-xs text-app-text-muted">
              {group.items.length} {t(group.items.length === 1 ? "search.resultCount.one" : "search.resultCount.many")}
            </span>
          </div>
          <VirtualList
            estimateSize={92}
            getKey={(item) => item.id}
            height={Math.min(420, Math.max(112, group.items.length * 92))}
            items={group.items}
            renderItem={(item) => <SearchResultItem item={item} />}
          />
        </section>
      ))}
    </div>
  );
}

function SearchResultItem({ item }: { item: SearchHit }) {
  const stateKey = stateLabels[item.processing_state] ?? "search.state.partial";

  return (
    <article
      aria-label={`${item.title}. ${t(typeLabels[item.type])}. ${item.reason}`}
      className="grid h-full grid-cols-[4.5rem_minmax(0,1fr)] gap-3 border-b border-app-border p-3 last:border-b-0"
    >
      <Thumbnail alt={item.title} className="max-w-none" src={item.thumbnail_url ?? undefined}>
        {t(typeLabels[item.type])}
      </Thumbnail>
      <div className="min-w-0">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-app-text">{item.title}</h3>
            {item.subtitle ? <p className="mt-0.5 truncate text-xs text-app-text-muted">{item.subtitle}</p> : null}
          </div>
          <span className="shrink-0 rounded-app-control border border-app-border bg-app-surface-muted px-2 py-1 text-xs text-app-text-muted">
            {formatScore(item.score)}
          </span>
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-app-text">{item.reason}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-app-text-muted">
          <span>{t(typeLabels[item.type])}</span>
          <span aria-hidden="true">/</span>
          <span>{t(stateKey)}</span>
        </div>
      </div>
    </article>
  );
}

function formatScore(score: number | null | undefined): string {
  if (!Number.isFinite(score)) {
    return t("search.scoreUnavailable");
  }

  return `${Math.round(Number(score) * 100)}%`;
}
