import { PhotosPage } from "../photos/PhotosPage";
import type { PhotosPageProps } from "../photos/PhotosPage";

export function FavoritesPage(props: Omit<PhotosPageProps, "favoritesOnly">) {
  return <PhotosPage {...props} favoritesOnly />;
}
