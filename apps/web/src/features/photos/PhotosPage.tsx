import { useEffect, useMemo, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "../../components/States";
import { Input } from "../../components/Input";
import { Thumbnail } from "../../components/Thumbnail";
import { photosApi } from "../../api/photos";
import type { PhotoAsset, PhotoTimelineGroup, PhotosApi, SearchPhotoResult } from "../../api/photos";
import { t } from "../../i18n/dictionary";
import { PhotoLightbox } from "./PhotoLightbox";
import { PhotoTimeline } from "./PhotoTimeline";
import { PhotoUploadButton } from "./PhotoUploadButton";

export type PhotosPageProps = {
  api?: PhotosApi;
  favoritesOnly?: boolean;
  initialQuery?: string;
};

type LoadState = "idle" | "loading" | "ready" | "error";

export function PhotosPage({ api = photosApi, favoritesOnly = false, initialQuery = "" }: PhotosPageProps) {
  const [groups, setGroups] = useState<PhotoTimelineGroup[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedAsset, setSelectedAsset] = useState<PhotoAsset | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [searchResults, setSearchResults] = useState<SearchPhotoResult[]>([]);
  const [searchState, setSearchState] = useState<LoadState>("idle");

  useEffect(() => {
    let active = true;

    async function loadTimeline() {
      setLoadState("loading");
      setError(null);
      try {
        const response = await api.getTimeline();
        if (active) {
          setGroups(response.groups);
          setLoadState("ready");
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : t("photos.loadError"));
          setLoadState("error");
        }
      }
    }

    void loadTimeline();

    return () => {
      active = false;
    };
  }, [api, refreshKey]);

  useEffect(() => {
    let active = true;
    const trimmed = query.trim();

    if (!trimmed) {
      setSearchResults([]);
      setSearchState("idle");
      return () => {
        active = false;
      };
    }

    async function loadSearch() {
      setSearchState("loading");
      try {
        const response = await api.searchPhotos(trimmed);
        if (active) {
          setSearchResults(response.items);
          setSearchState("ready");
        }
      } catch {
        if (active) {
          setSearchResults([]);
          setSearchState("error");
        }
      }
    }

    void loadSearch();

    return () => {
      active = false;
    };
  }, [api, query]);

  const visibleGroups = useMemo(() => {
    if (!favoritesOnly) {
      return groups;
    }

    return groups
      .map((group) => ({ ...group, assets: group.assets.filter((asset) => asset.favorite) }))
      .filter((group) => group.assets.length > 0);
  }, [favoritesOnly, groups]);

  const visibleAssets = useMemo(() => visibleGroups.flatMap((group) => group.assets), [visibleGroups]);
  const selectedIndex = selectedAsset ? visibleAssets.findIndex((asset) => asset.id === selectedAsset.id) : -1;
  const nextAsset = selectedIndex >= 0 && selectedIndex < visibleAssets.length - 1 ? visibleAssets[selectedIndex + 1] : null;
  const previousAsset = selectedIndex > 0 ? visibleAssets[selectedIndex - 1] : null;

  async function toggleFavorite(asset: PhotoAsset) {
    const updated = await api.toggleFavorite(asset.id, !asset.favorite);
    setGroups((current) => updateAssetInGroups(current, updated));
    setSelectedAsset((current) => (current?.id === updated.id ? updated : current));
  }

  async function openSearchResult(result: SearchPhotoResult) {
    if (!result.asset_id) {
      return;
    }

    const asset = await api.getPhoto(result.asset_id);
    setSelectedAsset(asset);
  }

  const emptyTitle = favoritesOnly ? t("favorites.emptyTitle") : t("photos.emptyTitle");
  const emptyBody = favoritesOnly ? t("favorites.emptyBody") : t("photos.emptyBody");

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-app-text">
            {favoritesOnly ? t("favorites.title") : t("photos.title")}
          </h1>
          <p className="mt-1 text-sm text-app-text-muted">
            {favoritesOnly ? t("favorites.subtitle") : t("photos.subtitle")}
          </p>
        </div>
        {!favoritesOnly ? <PhotoUploadButton api={api} onUploaded={() => setRefreshKey((value) => value + 1)} /> : null}
      </header>

      <Input
        label={t("photos.searchLabel")}
        onChange={(event) => setQuery(event.currentTarget.value)}
        placeholder={t("photos.searchPlaceholder")}
        type="search"
        value={query}
      />

      {query.trim() ? (
        <SearchResults
          items={searchResults}
          onOpen={openSearchResult}
          state={searchState}
        />
      ) : null}

      {loadState === "loading" ? <LoadingState label={t("photos.loading")} /> : null}
      {loadState === "error" ? (
        <ErrorState body={error ?? t("photos.loadError")} onRetry={() => setRefreshKey((value) => value + 1)} />
      ) : null}
      {loadState === "ready" && visibleGroups.length === 0 ? (
        <EmptyState body={emptyBody} title={emptyTitle} />
      ) : null}
      {loadState === "ready" && visibleGroups.length > 0 ? (
        <PhotoTimeline groups={visibleGroups} onOpen={setSelectedAsset} onToggleFavorite={toggleFavorite} />
      ) : null}

      <PhotoLightbox
        asset={selectedAsset}
        onClose={() => setSelectedAsset(null)}
        onNext={nextAsset ? () => setSelectedAsset(nextAsset) : undefined}
        onPrevious={previousAsset ? () => setSelectedAsset(previousAsset) : undefined}
        onToggleFavorite={toggleFavorite}
      />
    </div>
  );
}

function SearchResults({
  items,
  onOpen,
  state,
}: {
  items: SearchPhotoResult[];
  onOpen: (result: SearchPhotoResult) => void;
  state: LoadState;
}) {
  if (state === "loading") {
    return <LoadingState label={t("photos.searching")} />;
  }

  if (state === "error") {
    return <ErrorState body={t("photos.searchError")} />;
  }

  if (state === "ready" && items.length === 0) {
    return <EmptyState body={t("photos.searchEmptyBody")} title={t("photos.searchEmptyTitle")} />;
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <section aria-label={t("photos.searchResultsLabel")} className="grid gap-2">
      <h2 className="text-sm font-semibold text-app-text">{t("photos.searchResults")}</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <button
            className="grid min-h-24 grid-cols-[5rem_1fr] gap-3 rounded-app-card border border-app-border bg-app-surface p-2 text-left transition-colors hover:bg-app-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent"
            key={item.id}
            onClick={() => onOpen(item)}
            type="button"
          >
            <Thumbnail alt={item.title} className="max-w-none" src={item.thumbnail_url ?? undefined} />
            <span className="min-w-0 self-center">
              <span className="block truncate text-sm font-medium text-app-text">{item.title}</span>
              <span className="mt-1 block line-clamp-2 text-xs text-app-text-muted">{item.reason}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function updateAssetInGroups(groups: PhotoTimelineGroup[], updated: PhotoAsset): PhotoTimelineGroup[] {
  return groups.map((group) => ({
    ...group,
    assets: group.assets.map((asset) => (asset.id === updated.id ? updated : asset)),
  }));
}
