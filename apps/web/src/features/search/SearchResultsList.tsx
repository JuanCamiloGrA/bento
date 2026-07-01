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
    <div className="grid gap-5" role="list" aria-label={t("search.results.label")}>
      {groups.map((group) => (
        <section aria-labelledby={`search-group-${group.type}`} className="grid gap-3" key={group.type}>
          <div className="flex items-center justify-between gap-3 border-b border-app-border/40 pb-1.5 px-1">
            <h2 className="text-base font-bold tracking-tight text-app-text/90" id={`search-group-${group.type}`}>
              {t(typeLabels[group.type])}
            </h2>
            <span className="text-xs text-app-text-muted font-medium bg-slate-100 px-2 py-0.5 rounded-full select-none">
              {group.items.length} {t(group.items.length === 1 ? "search.resultCount.one" : "search.resultCount.many")}
            </span>
          </div>
          <VirtualList
            estimateSize={104}
            getKey={(item) => item.id}
            height={Math.min(460, Math.max(124, group.items.length * 104))}
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
      className="grid h-full grid-cols-[5rem_minmax(0,1fr)] gap-4 border-b border-app-border bg-app-surface p-4 hover:bg-slate-50/50 transition-all duration-150 last:border-b-0"
    >
      <Thumbnail alt={item.title} className="max-w-none rounded-lg shadow-3xs" src={item.thumbnail_url ?? undefined}>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-app-text-muted/60">{t(typeLabels[item.type])}</span>
      </Thumbnail>
      <div className="min-w-0">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold tracking-tight text-app-text">{item.title}</h3>
            {item.subtitle ? <p className="mt-0.5 truncate text-xs text-app-text-muted/80">{item.subtitle}</p> : null}
          </div>
          <span className="shrink-0 rounded-app-control border border-app-border bg-slate-50 px-2 py-0.5 text-xs font-bold text-app-accent shadow-3xs">
            {formatScore(item.score)}
          </span>
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-app-text/95 leading-relaxed font-medium">{item.reason}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-app-text-muted">
          <span className="text-app-accent/90">{t(typeLabels[item.type])}</span>
          <span aria-hidden="true" className="opacity-30">/</span>
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
