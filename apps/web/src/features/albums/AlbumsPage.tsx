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
    <div className="mx-auto grid w-full max-w-6xl gap-4">
      <header>
        <h1 className="text-2xl font-semibold text-app-text">{t("albums.title")}</h1>
        <p className="mt-1 text-sm text-app-text-muted">{t("albums.subtitle")}</p>
      </header>

      <form
        className="grid gap-2 rounded-app-card border border-app-border bg-app-surface p-3 sm:grid-cols-[1fr_auto] sm:items-end"
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
        <section aria-label={t("albums.listLabel")} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
    <article className="grid min-h-48 grid-rows-[1fr_auto] overflow-hidden rounded-app-card border border-app-border bg-app-surface">
      <Thumbnail
        alt={album.title}
        className="max-w-none rounded-none border-0"
        src={album.cover_asset ? assetThumbnailUrl(album.cover_asset) : undefined}
      >
        {t("albums.emptyCover")}
      </Thumbnail>
      <div className="grid gap-2 p-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-app-text">{album.title}</h2>
          <p className="text-xs text-app-text-muted">
            {album.asset_ids.length} {album.asset_ids.length === 1 ? t("photos.item") : t("photos.items")}
          </p>
        </div>
        <Button onClick={() => onOpenAlbum?.(album.id)} variant="secondary">
          {t("albums.open")}
        </Button>
      </div>
    </article>
  );
}
