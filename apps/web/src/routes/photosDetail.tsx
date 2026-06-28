import { PhotoDetailPage } from "../features/photos/PhotoDetailPage";

export function PhotoDetailRoute() {
  return <PhotoDetailPage assetId={assetIdFromPath("/photos/")} />;
}

function assetIdFromPath(prefix: string): string {
  return decodeURIComponent(window.location.pathname.replace(prefix, "").replace(/\/$/, ""));
}
