import { AlbumsPage } from "../features/albums/AlbumsPage";

export function AlbumsRoute() {
  return (
    <AlbumsPage
      onOpenAlbum={(albumId) => {
        window.history.pushState({}, "", `/albums/${encodeURIComponent(albumId)}`);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }}
    />
  );
}
