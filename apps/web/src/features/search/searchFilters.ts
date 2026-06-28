import type { SearchHit, SearchRequest, SearchResultType } from "../../api/search";
import type { MessageKey } from "../../i18n/dictionary";

export type SearchFilters = {
  dateFrom: string;
  dateTo: string;
  folderId: string;
  q: string;
  type: SearchResultType | "";
};

export type SearchScope = "global" | "documents";

export const searchTypeOptions: Array<{ labelKey: MessageKey; value: SearchResultType | "" }> = [
  { labelKey: "search.filter.type.all", value: "" },
  { labelKey: "search.type.asset", value: "asset" },
  { labelKey: "search.type.folder", value: "folder" },
  { labelKey: "search.type.photo", value: "photo" },
  { labelKey: "search.type.video", value: "video" },
  { labelKey: "search.type.document", value: "document" },
  { labelKey: "search.type.pdf_page", value: "pdf_page" },
  { labelKey: "search.type.ocr_block", value: "ocr_block" },
  { labelKey: "search.type.album", value: "album" },
];

export const documentTypeOptions: Array<{ labelKey: MessageKey; value: SearchResultType }> = [
  { labelKey: "documents.filter.type.documents", value: "document" },
  { labelKey: "documents.filter.type.pdfPages", value: "pdf_page" },
];

export function parseSearchFilters(search: string, scope: SearchScope): SearchFilters {
  const params = new URLSearchParams(search);
  const parsedType = parseSearchResultType(params.get("type"));

  return {
    dateFrom: params.get("date_from") ?? "",
    dateTo: params.get("date_to") ?? "",
    folderId: params.get("folder_id") ?? "",
    q: params.get("q") ?? "",
    type: scope === "documents" ? parsedType || "document" : parsedType,
  };
}

export function toSearchRequest(filters: SearchFilters, limit = 50): SearchRequest {
  return {
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    folderId: filters.folderId,
    limit,
    q: filters.q,
    type: filters.type || undefined,
  };
}

export function toUrlSearch(filters: SearchFilters): string {
  const params = new URLSearchParams();

  setIfPresent(params, "q", filters.q);
  setIfPresent(params, "type", filters.type);
  setIfPresent(params, "folder_id", filters.folderId);
  setIfPresent(params, "date_from", filters.dateFrom);
  setIfPresent(params, "date_to", filters.dateTo);

  return params.toString();
}

export function groupSearchHits(items: SearchHit[]): Array<{ items: SearchHit[]; type: SearchResultType }> {
  const sortedItems = [...items].sort(compareSearchHits);
  const grouped = new Map<SearchResultType, SearchHit[]>();

  for (const item of sortedItems) {
    const group = grouped.get(item.type) ?? [];
    group.push(item);
    grouped.set(item.type, group);
  }

  return Array.from(grouped, ([type, groupItems]) => ({ items: groupItems, type }));
}

function compareSearchHits(left: SearchHit, right: SearchHit): number {
  const scoreDelta = normalizedScore(right.score) - normalizedScore(left.score);

  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  return left.id.localeCompare(right.id);
}

function normalizedScore(score: number | null | undefined): number {
  return Number.isFinite(score) ? Number(score) : 0;
}

function parseSearchResultType(value: string | null): SearchResultType | "" {
  const validTypes = new Set(searchTypeOptions.map((option) => option.value).filter(Boolean));

  return value && validTypes.has(value as SearchResultType) ? (value as SearchResultType) : "";
}

function setIfPresent(params: URLSearchParams, key: string, value: string): void {
  const normalized = value.trim();

  if (normalized) {
    params.set(key, normalized);
  }
}
