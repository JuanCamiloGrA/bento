import { IconButton } from "../../components/IconButton";
import { Thumbnail } from "../../components/Thumbnail";
import { assetThumbnailUrl } from "../../api/photos";
import type { PhotoAsset } from "../../api/photos";
import { t } from "../../i18n/dictionary";
import { ProcessingStateBadge } from "./ProcessingStateBadge";

export type PhotoCardProps = {
  asset: PhotoAsset;
  onOpen: (asset: PhotoAsset) => void;
  onToggleFavorite: (asset: PhotoAsset) => void;
};

export function PhotoCard({ asset, onOpen, onToggleFavorite }: PhotoCardProps) {
  const favoriteLabel = asset.favorite ? t("photos.unfavorite") : t("photos.favorite");

  return (
    <article className="grid h-full grid-rows-[1fr_auto] overflow-hidden rounded-app-card border border-app-border bg-app-surface shadow-2xs hover:shadow-md hover:border-slate-300 transition-all duration-300 group">
      <button
        className="min-h-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent overflow-hidden"
        onClick={() => onOpen(asset)}
        type="button"
      >
        <Thumbnail alt={asset.filename} className="max-w-none rounded-none border-0 transition-transform duration-500 group-hover:scale-[1.03]" src={assetThumbnailUrl(asset)}>
          {asset.kind === "video" ? t("photos.video") : t("photos.thumbnailPending")}
        </Thumbnail>
      </button>
      <div className="grid gap-2.5 p-3">
        <div className="flex min-w-0 items-start justify-between gap-2.5">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold tracking-tight text-app-text">{asset.filename}</h3>
            <p className="text-xs text-app-text-muted mt-0.5">{asset.kind === "video" ? t("photos.video") : t("photos.photo")}</p>
          </div>
          <IconButton
            icon={asset.favorite ? "*" : "+"}
            label={favoriteLabel}
            onClick={() => onToggleFavorite(asset)}
          />
        </div>
        <ProcessingStateBadge state={asset.processing_state} />
      </div>
    </article>
  );
}
