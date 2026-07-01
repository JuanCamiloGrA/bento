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
    <div className="grid w-full gap-5">
      <header className="grid gap-4 sm:grid-cols-[8rem_1fr] sm:items-center border-b border-app-border/80 pb-5">
        <Thumbnail
          alt={album.title}
          className="max-w-none rounded-xl border border-app-border/80 shadow-sm"
          src={album.cover_asset ? assetThumbnailUrl(album.cover_asset) : undefined}
        >
          <span className="text-app-text-muted/60 font-semibold tracking-wide text-xs">{t("albums.emptyCover")}</span>
        </Thumbnail>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight text-app-text">{album.title}</h1>
          <p className="mt-1 text-xs text-app-text-muted font-medium bg-slate-100 px-2 py-0.5 rounded-full inline-block select-none">
            {album.asset_ids.length} {album.asset_ids.length === 1 ? t("photos.item") : t("photos.items")}
          </p>
        </div>
      </header>

      <form
        className="grid gap-3 rounded-app-card border border-app-border bg-app-surface p-4 shadow-2xs sm:grid-cols-[1fr_auto] sm:items-end transition-all duration-200"
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
              className="flex min-h-14 items-center justify-between gap-4 rounded-app-card border border-app-border bg-app-surface px-4 py-2 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 shadow-2xs"
              key={itemAssetId}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-app-text-muted/40 shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                    <circle cx="9" cy="9" r="2"/>
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                  </svg>
                </span>
                <span className="min-w-0 truncate text-sm font-semibold text-app-text">{itemAssetId}</span>
              </div>
              <Button disabled={mutating} onClick={() => void removeItem(itemAssetId)} variant="danger" className="h-8.5 px-3 text-xs font-semibold">
                {t("albums.removeItem")}
              </Button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
