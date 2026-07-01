import { VirtualGrid } from "../../components/VirtualGrid";
import type { PhotoAsset } from "../../api/photos";
import { PhotoCard } from "./PhotoCard";

export type PhotoGridProps = {
  assets: PhotoAsset[];
  height?: number;
  onOpen: (asset: PhotoAsset) => void;
  onToggleFavorite: (asset: PhotoAsset) => void;
};

export function PhotoGrid({ assets, height = 400, onOpen, onToggleFavorite }: PhotoGridProps) {
  return (
    <VirtualGrid
      getKey={(asset) => asset.id}
      height={height}
      items={assets}
      minColumnWidth={220}
      renderItem={(asset) => (
        <PhotoCard asset={asset} onOpen={onOpen} onToggleFavorite={onToggleFavorite} />
      )}
      rowHeight={300}
    />
  );
}
