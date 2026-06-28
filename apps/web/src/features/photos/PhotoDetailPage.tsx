import { useEffect, useState } from "react";

import { ErrorState, LoadingState } from "../../components/States";
import { photosApi } from "../../api/photos";
import type { PhotoAsset, PhotosApi } from "../../api/photos";
import { t } from "../../i18n/dictionary";
import { PhotoLightbox } from "./PhotoLightbox";

type LoadState = "loading" | "ready" | "error";

export type PhotoDetailPageProps = {
  api?: PhotosApi;
  assetId: string;
};

export function PhotoDetailPage({ api = photosApi, assetId }: PhotoDetailPageProps) {
  const [asset, setAsset] = useState<PhotoAsset | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  useEffect(() => {
    let active = true;

    async function loadPhoto() {
      setLoadState("loading");
      try {
        const response = await api.getPhoto(assetId);
        if (active) {
          setAsset(response);
          setLoadState("ready");
        }
      } catch {
        if (active) {
          setLoadState("error");
        }
      }
    }

    void loadPhoto();

    return () => {
      active = false;
    };
  }, [api, assetId]);

  async function toggleFavorite(current: PhotoAsset) {
    const updated = await api.toggleFavorite(current.id, !current.favorite);
    setAsset(updated);
  }

  if (loadState === "loading") {
    return <LoadingState label={t("photos.loading")} />;
  }

  if (loadState === "error" || !asset) {
    return <ErrorState body={t("photos.loadError")} />;
  }

  return (
    <PhotoLightbox
      asset={asset}
      onClose={() => window.history.back()}
      onToggleFavorite={(current) => {
        void toggleFavorite(current);
      }}
    />
  );
}
