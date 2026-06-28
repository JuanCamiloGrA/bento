import { apiClient } from "./client";
import type { PhotoAsset } from "./photos";

export type Album = {
  asset_ids: string[];
  cover_asset?: PhotoAsset | null;
  created_at: string;
  id: string;
  title: string;
  updated_at: string;
};

export type AlbumsResponse = {
  albums: Album[];
  next_cursor: string | null;
};

export type AlbumsApi = {
  addAlbumItem(albumId: string, assetId: string): Promise<Album>;
  createAlbum(title: string): Promise<Album>;
  getAlbum(albumId: string): Promise<Album>;
  listAlbums(options?: { cursor?: string | null; limit?: number }): Promise<AlbumsResponse>;
  removeAlbumItem(albumId: string, assetId: string): Promise<Album>;
};

type ApiRequest = <TResponse>(path: string, options?: { body?: BodyInit | Record<string, unknown>; method?: string }) => Promise<TResponse>;

export function createAlbumsApi(request: ApiRequest = apiClient.request): AlbumsApi {
  return {
    async addAlbumItem(albumId, assetId) {
      const raw = await request<unknown>(`/photos/albums/${encodeURIComponent(albumId)}/items`, {
        body: { asset_id: assetId },
        method: "POST",
      });
      return normalizeAlbum(raw);
    },

    async createAlbum(title) {
      const raw = await request<unknown>("/photos/albums", {
        body: { title },
        method: "POST",
      });
      return normalizeAlbum(raw);
    },

    async getAlbum(albumId) {
      const raw = await request<unknown>(`/photos/albums/${encodeURIComponent(albumId)}`);
      return normalizeAlbum(raw);
    },

    async listAlbums(options = {}) {
      const params = new URLSearchParams();
      params.set("limit", String(options.limit ?? 50));
      if (options.cursor) {
        params.set("cursor", options.cursor);
      }

      const raw = await request<unknown>(`/photos/albums?${params.toString()}`);
      return normalizeAlbumsResponse(raw);
    },

    async removeAlbumItem(albumId, assetId) {
      const raw = await request<unknown>(
        `/photos/albums/${encodeURIComponent(albumId)}/items/${encodeURIComponent(assetId)}`,
        { method: "DELETE" },
      );
      return normalizeAlbum(raw);
    },
  };
}

export const albumsApi = createAlbumsApi();

function normalizeAlbumsResponse(raw: unknown): AlbumsResponse {
  if (!isRecord(raw)) {
    return { albums: [], next_cursor: null };
  }

  const rawAlbums = Array.isArray(raw.albums) ? raw.albums : Array.isArray(raw.items) ? raw.items : [];

  return {
    albums: rawAlbums.map(normalizeAlbum),
    next_cursor: typeof raw.next_cursor === "string" ? raw.next_cursor : null,
  };
}

function normalizeAlbum(raw: unknown): Album {
  if (!isRecord(raw)) {
    throw new TypeError("Invalid album response");
  }

  const id = stringValue(raw.id, "album");
  const rawAssetIds = Array.isArray(raw.asset_ids) ? raw.asset_ids : [];

  return {
    asset_ids: rawAssetIds.filter((assetId): assetId is string => typeof assetId === "string"),
    cover_asset: isRecord(raw.cover_asset) ? (raw.cover_asset as PhotoAsset) : null,
    created_at: stringValue(raw.created_at, new Date(0).toISOString()),
    id,
    title: stringValue(raw.title, id),
    updated_at: stringValue(raw.updated_at, stringValue(raw.created_at, new Date(0).toISOString())),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}
