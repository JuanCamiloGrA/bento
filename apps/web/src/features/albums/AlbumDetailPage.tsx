import { useEffect, useState } from "react";

import { Button } from "../../components/Button";
import { EmptyState, ErrorState, LoadingState } from "../../components/States";
import { Input } from "../../components/Input";
import { Thumbnail } from "../../components/Thumbnail";
import { albumsApi } from "../../api/albums";
import type { Album, AlbumsApi } from "../../api/albums";
import { assetThumbnailUrl } from "../../api/photos";
import { t } from "../../i18n/dictionary";

type LoadState = "idle" | "loading" | "ready" | "error";

export type AlbumDetailPageProps = {
  albumId: string;
  api?: AlbumsApi;
};

export function AlbumDetailPage({ albumId, api = albumsApi }: AlbumDetailPageProps) {
  const [album, setAlbum] = useState<Album | null>(null);
  const [assetId, setAssetId] = useState("");
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadAlbum() {
      setLoadState("loading");
      setError(null);
      try {
        const response = await api.getAlbum(albumId);
        if (active) {
          setAlbum(response);
          setLoadState("ready");
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : t("albums.loadError"));
          setLoadState("error");
        }
      }
    }

    void loadAlbum();

    return () => {
      active = false;
    };
  }, [albumId, api, refreshKey]);

  async function addItem() {
    const trimmed = assetId.trim();
    if (!trimmed) {
      return;
    }

    setMutating(true);
    try {
      const updated = await api.addAlbumItem(albumId, trimmed);
      setAlbum(updated);
      setAssetId("");
    } finally {
      setMutating(false);
    }
  }

  async function removeItem(itemAssetId: string) {
    setMutating(true);
    try {
      const updated = await api.removeAlbumItem(albumId, itemAssetId);
      setAlbum(updated);
    } finally {
      setMutating(false);
    }
  }

  if (loadState === "loading") {
    return <LoadingState label={t("albums.loading")} />;
  }

  if (loadState === "error") {
    return <ErrorState body={error ?? t("albums.loadError")} onRetry={() => setRefreshKey((value) => value + 1)} />;
  }

  if (!album) {
    return <EmptyState body={t("albums.detailEmptyBody")} title={t("albums.detailEmptyTitle")} />;
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4">
      <header className="grid gap-3 sm:grid-cols-[10rem_1fr] sm:items-end">
        <Thumbnail
          alt={album.title}
          className="max-w-none"
          src={album.cover_asset ? assetThumbnailUrl(album.cover_asset) : undefined}
        >
          {t("albums.emptyCover")}
        </Thumbnail>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-app-text">{album.title}</h1>
          <p className="mt-1 text-sm text-app-text-muted">
            {album.asset_ids.length} {album.asset_ids.length === 1 ? t("photos.item") : t("photos.items")}
          </p>
        </div>
      </header>

      <form
        className="grid gap-2 rounded-app-card border border-app-border bg-app-surface p-3 sm:grid-cols-[1fr_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          void addItem();
        }}
      >
        <Input
          label={t("albums.addItemLabel")}
          onChange={(event) => setAssetId(event.currentTarget.value)}
          placeholder={t("albums.addItemPlaceholder")}
          value={assetId}
        />
        <Button disabled={mutating || !assetId.trim()} type="submit" variant="primary">
          {t("albums.addItem")}
        </Button>
      </form>

      {album.asset_ids.length === 0 ? (
        <EmptyState body={t("albums.albumEmptyBody")} title={t("albums.albumEmptyTitle")} />
      ) : (
        <section aria-label={t("albums.itemsLabel")} className="grid gap-2">
          {album.asset_ids.map((itemAssetId) => (
            <div
              className="flex min-h-12 items-center justify-between gap-3 rounded-app-card border border-app-border bg-app-surface px-3 py-2"
              key={itemAssetId}
            >
              <span className="min-w-0 truncate text-sm text-app-text">{itemAssetId}</span>
              <Button disabled={mutating} onClick={() => void removeItem(itemAssetId)} variant="danger">
                {t("albums.removeItem")}
              </Button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
