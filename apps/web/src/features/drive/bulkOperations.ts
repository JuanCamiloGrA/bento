import type { DriveApi } from "../../api/drive";
import type { DriveEntry } from "./driveModel";

export async function deleteDriveEntries(api: DriveApi, entries: DriveEntry[]): Promise<void> {
  await Promise.all(
    entries.map((entry) => (entry.kind === "folder" ? api.deleteFolder(entry.id) : api.deleteAsset(entry.id))),
  );
}

export async function moveDriveEntries(api: DriveApi, entries: DriveEntry[], targetFolderId: string | null): Promise<void> {
  await Promise.all(
    entries.map((entry) =>
      entry.kind === "folder"
        ? api.moveFolder({ folderId: entry.id, parentId: targetFolderId })
        : api.moveAsset({ assetId: entry.id, folderId: targetFolderId }),
    ),
  );
}

export function downloadableDriveEntries(entries: DriveEntry[]): DriveEntry[] {
  return entries.filter((entry) => entry.kind === "asset");
}

export function downloadDriveEntries(api: DriveApi, entries: DriveEntry[], open: (url: string) => void): void {
  for (const entry of downloadableDriveEntries(entries)) {
    open(api.downloadUrl(entry.id));
  }
}
