import type { PhotoAsset } from "../../api/photos";
import { PhotoCard } from "./PhotoCard";

export type PhotoGridProps = {
  assets: PhotoAsset[];
  onOpen: (asset: PhotoAsset) => void;
};

export function PhotoGrid({ assets, onOpen }: PhotoGridProps) {
  return (
    <div className="flex flex-wrap content-start items-start gap-1.5">
      {assets.map((asset) => (
        <PhotoCard asset={asset} key={asset.id} onOpen={onOpen} />
      ))}
    </div>
  );
}
