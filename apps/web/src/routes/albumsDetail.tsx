import { AlbumDetailPage } from "../features/albums/AlbumDetailPage";

export function AlbumDetailRoute() {
  return <AlbumDetailPage albumId={albumIdFromPath()} />;
}

function albumIdFromPath(): string {
  return decodeURIComponent(window.location.pathname.replace("/albums/", "").replace(/\/$/, ""));
}
