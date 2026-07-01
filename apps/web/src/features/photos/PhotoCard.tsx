import { assetPreviewUrl, assetThumbnailUrl } from "../../api/photos";
import type { PhotoAsset } from "../../api/photos";
import { cx } from "../../lib/cx";

export type PhotoCardProps = {
  asset: PhotoAsset;
  onOpen: (asset: PhotoAsset) => void;
};

export function PhotoCard({ asset, onOpen }: PhotoCardProps) {
  const src = asset.kind === "image" ? assetPreviewUrl(asset) : assetThumbnailUrl(asset);

  return (
    <button
      aria-label={asset.filename}
      className="group relative block overflow-hidden rounded-md bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent"
      onClick={() => onOpen(asset)}
      type="button"
    >
      <img
        alt={asset.filename}
        className={cx(
          "block h-40 w-auto max-w-none object-contain select-none transition duration-200 group-hover:brightness-95 sm:h-44 lg:h-48",
          asset.kind === "video" ? "aspect-video bg-slate-900 object-cover" : "",
        )}
        loading="lazy"
        src={src}
      />
    </button>
  );
}
