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

export type AlbumsPageProps = {
  api?: AlbumsApi;
  onOpenAlbum?: (albumId: string) => void;
};

export function AlbumsPage({ api = albumsApi, onOpenAlbum }: AlbumsPageProps) {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadAlbums() {
      setLoadState("loading");
      setError(null);
      try {
        const response = await api.listAlbums();
        if (active) {
          setAlbums(response.albums);
          setLoadState("ready");
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : t("albums.loadError"));
          setLoadState("error");
        }
      }
    }

    void loadAlbums();

    return () => {
      active = false;
    };
  }, [api, refreshKey]);

  async function createAlbum() {
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }

    setCreating(true);
    try {
      const album = await api.createAlbum(trimmed);
      setAlbums((current) => [album, ...current.filter((item) => item.id !== album.id)]);
      setTitle("");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="grid w-full gap-5">
      <header className="flex flex-col gap-1 border-b border-app-border/80 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-app-text">{t("albums.title")}</h1>
        <p className="text-sm text-app-text-muted">{t("albums.subtitle")}</p>
      </header>

      <form
        className="grid gap-3 rounded-app-card border border-app-border bg-app-surface p-4 shadow-2xs sm:grid-cols-[1fr_auto] sm:items-end transition-all duration-200"
        onSubmit={(event) => {
          event.preventDefault();
          void createAlbum();
        }}
      >
        <Input
          label={t("albums.createLabel")}
          onChange={(event) => setTitle(event.currentTarget.value)}
          placeholder={t("albums.createPlaceholder")}
          value={title}
        />
        <Button disabled={creating || !title.trim()} type="submit" variant="primary">
          {creating ? t("albums.creating") : t("albums.create")}
        </Button>
      </form>

      {loadState === "loading" ? <LoadingState label={t("albums.loading")} /> : null}
      {loadState === "error" ? (
        <ErrorState body={error ?? t("albums.loadError")} onRetry={() => setRefreshKey((value) => value + 1)} />
      ) : null}
      {loadState === "ready" && albums.length === 0 ? (
        <EmptyState body={t("albums.emptyBody")} title={t("albums.emptyTitle")} />
      ) : null}
      {albums.length > 0 ? (
        <section aria-label={t("albums.listLabel")} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => (
            <AlbumCard album={album} key={album.id} onOpenAlbum={onOpenAlbum} />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function AlbumCard({ album, onOpenAlbum }: { album: Album; onOpenAlbum?: (albumId: string) => void }) {
  return (
    <article className="grid min-h-56 grid-rows-[1fr_auto] overflow-hidden rounded-app-card border border-app-border bg-app-surface shadow-2xs hover:shadow-md hover:border-slate-300 transition-all duration-300 group">
      <div className="overflow-hidden relative aspect-video bg-slate-100 flex items-center justify-center">
        <Thumbnail
          alt={album.title}
          className="w-full h-full rounded-none border-0 transition-transform duration-500 group-hover:scale-[1.03]"
          src={album.cover_asset ? assetThumbnailUrl(album.cover_asset) : undefined}
        >
          <span className="text-app-text-muted/60 font-semibold tracking-wide text-xs">{t("albums.emptyCover")}</span>
        </Thumbnail>
      </div>
      <div className="grid gap-3 p-4 bg-app-surface border-t border-app-border/40">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold tracking-tight text-app-text group-hover:text-app-accent transition-colors">{album.title}</h2>
          <p className="text-xs text-app-text-muted mt-1 font-medium bg-slate-150 px-2 py-0.5 rounded-full inline-block select-none">
            {album.asset_ids.length} {album.asset_ids.length === 1 ? t("photos.item") : t("photos.items")}
          </p>
        </div>
        <Button onClick={() => onOpenAlbum?.(album.id)} variant="secondary" className="w-full cursor-pointer h-9 text-xs font-semibold">
          {t("albums.open")}
        </Button>
      </div>
    </article>
  );
}
