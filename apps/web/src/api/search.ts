import { apiClient } from "./client";
import type { ApiClientOptions } from "./client";
import { createApiClient } from "./client";

export type SearchResultType =
  | "asset"
  | "folder"
  | "photo"
  | "video"
  | "document"
  | "pdf_page"
  | "ocr_block"
  | "album";

export type SearchProcessingState = "indexed" | "indexing" | "pending" | "partial" | "disabled" | "failed";

export type SearchHit = {
  asset_id?: string;
  id: string;
  processing_state: SearchProcessingState;
  reason: string;
  score?: number | null;
  subtitle?: string | null;
  thumbnail_url?: string | null;
  title: string;
  type: SearchResultType;
};

export type SearchFacet = {
  count: number;
  type: SearchResultType;
};

export type SearchResponse = {
  facets: SearchFacet[];
  items: SearchHit[];
  next_cursor: string | null;
};

export type SearchRequest = {
  cursor?: string;
  dateFrom?: string;
  dateTo?: string;
  folderId?: string;
  limit?: number;
  q?: string;
  type?: SearchResultType;
};

export type SearchApi = {
  search: (request: SearchRequest) => Promise<SearchResponse>;
};

export function createSearchApi(options: ApiClientOptions = {}): SearchApi {
  const client = options.baseUrl || options.fetcher ? createApiClient(options) : apiClient;

  return {
    search(request) {
      return client.request<SearchResponse>(`/search${toQueryString(request)}`);
    },
  };
}

export const searchApi = createSearchApi();

function toQueryString(request: SearchRequest): string {
  const params = new URLSearchParams();

  appendIfPresent(params, "q", request.q);
  appendIfPresent(params, "type", request.type);
  appendIfPresent(params, "folder_id", request.folderId);
  appendIfPresent(params, "date_from", request.dateFrom);
  appendIfPresent(params, "date_to", request.dateTo);
  appendIfPresent(params, "cursor", request.cursor);

  if (request.limit !== undefined) {
    params.set("limit", String(request.limit));
  }

  const query = params.toString();

  return query ? `?${query}` : "";
}

function appendIfPresent(params: URLSearchParams, key: string, value: string | undefined): void {
  const normalized = value?.trim();

  if (normalized) {
    params.set(key, normalized);
  }
}
