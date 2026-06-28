import { DriveBrowser } from "../features/drive/DriveBrowser";

export type DriveRouteProps = {
  pathname?: string;
};

export function DriveRoute({ pathname = window.location.pathname }: DriveRouteProps) {
  const initialFolderId = folderIdFromPath(pathname);

  return (
    <DriveBrowser
      initialFolderId={initialFolderId}
      onNavigate={(folderId) => {
        const path = folderId ? `/drive/folders/${encodeURIComponent(folderId)}` : "/drive";
        window.history.pushState({}, "", path);
      }}
    />
  );
}

export function folderIdFromPath(pathname: string): string | null {
  const match = /^\/drive\/folders\/([^/]+)\/?$/.exec(pathname);
  return match ? decodeURIComponent(match[1]) : null;
}
