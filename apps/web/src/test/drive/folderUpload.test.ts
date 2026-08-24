import { describe, expect, it, vi } from "vitest";

import type { DriveApi, DriveAsset, DriveFolder, DriveItemsResponse } from "../../api/drive";
import { selectionFromDataTransfer, selectionFromFiles, uploadSelection } from "../../features/drive/folderUpload";

describe("folder upload", () => {
  it("keeps the full relative hierarchy from a folder picker", () => {
    const cover = relativeFile("cover.jpg", "Proyecto/cover.jpg");
    const report = relativeFile("report.pdf", "Proyecto/Documentos/2026/report.pdf");

    expect(selectionFromFiles([report, cover])).toEqual({
      directories: ["Proyecto", "Proyecto/Documentos", "Proyecto/Documentos/2026"],
      files: [
        { file: cover, relativePath: "Proyecto/cover.jpg" },
        { file: report, relativePath: "Proyecto/Documentos/2026/report.pdf" },
      ],
    });
  });

  it("walks dropped directories and preserves empty folders", async () => {
    const photo = new File(["image"], "photo.jpg", { type: "image/jpeg" });
    const photoEntry = fileEntry(photo);
    const emptyEntry = directoryEntry("Vacía", [[]]);
    const albumEntry = directoryEntry("Álbum", [[photoEntry, emptyEntry], []]);
    const item = { kind: "file", webkitGetAsEntry: () => albumEntry } as unknown as DataTransferItem;
    const dataTransfer = { files: [], items: [item] } as unknown as DataTransfer;

    await expect(selectionFromDataTransfer(dataTransfer)).resolves.toEqual({
      directories: ["Álbum", "Álbum/Vacía"],
      files: [{ file: photo, relativePath: "Álbum/photo.jpg" }],
    });
  });

  it("reuses existing folders and creates nested folders before uploading", async () => {
    const existing = folder("folder_project", "Proyecto", null);
    const created = folder("folder_docs", "Documentos", existing.id);
    const uploadedAsset = asset("asset_report", created.id);
    const listItems = vi.fn(async ({ folderId }: { folderId: string | null }): Promise<DriveItemsResponse> => ({
      breadcrumbs: [],
      items: folderId === null ? [{ folder: existing, type: "folder" }] : [],
      next_cursor: null,
    }));
    const createFolder = vi.fn(async () => created);
    const uploadFiles = vi.fn(async () => [uploadedAsset]);
    const progress = vi.fn();
    const api = driveApiMock({ createFolder, listItems, uploadFiles });
    const report = relativeFile("report.pdf", "Proyecto/Documentos/report.pdf");

    const summary = await uploadSelection({
      api,
      destinationFolderId: null,
      onProgress: progress,
      selection: selectionFromFiles([report]),
    });

    expect(createFolder).toHaveBeenCalledTimes(1);
    expect(createFolder).toHaveBeenCalledWith({ name: "Documentos", parentId: existing.id });
    expect(uploadFiles).toHaveBeenCalledWith({ files: [report], folderId: created.id });
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ completedFiles: 1, totalFiles: 1 }));
    expect(summary).toEqual({ failures: [], skippedDuplicates: 0, uploaded: 1 });
  });

  it("continues after individual upload failures and reports duplicate files", async () => {
    const first = new File(["one"], "one.txt", { type: "text/plain" });
    const second = new File(["two"], "two.txt", { type: "text/plain" });
    const uploadFiles = vi
      .fn()
      .mockResolvedValueOnce([{ ...asset("asset_existing", "somewhere_else"), duplicate: true }])
      .mockRejectedValueOnce(new Error("network unavailable"));
    const api = driveApiMock({ uploadFiles });

    const summary = await uploadSelection({
      api,
      concurrency: 1,
      destinationFolderId: null,
      selection: selectionFromFiles([first, second]),
    });

    expect(summary.uploaded).toBe(0);
    expect(summary.skippedDuplicates).toBe(1);
    expect(summary.failures).toHaveLength(1);
    expect(summary.failures[0].relativePath).toBe("two.txt");
  });
});

function relativeFile(name: string, relativePath: string): File {
  const file = new File([name], name);
  Object.defineProperty(file, "webkitRelativePath", { configurable: true, value: relativePath });
  return file;
}

function fileEntry(file: File) {
  return {
    file: (success: (value: File) => void) => success(file),
    isDirectory: false,
    isFile: true,
    name: file.name,
  };
}

function directoryEntry(name: string, batches: unknown[][]) {
  let index = 0;
  return {
    createReader: () => ({
      readEntries: (success: (entries: unknown[]) => void) => success(batches[index++] ?? []),
    }),
    isDirectory: true,
    isFile: false,
    name,
  };
}

function folder(id: string, name: string, parentId: string | null): DriveFolder {
  return {
    created_at: "2026-01-01T00:00:00Z",
    id,
    name,
    parent_id: parentId,
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function asset(id: string, folderId: string | null): DriveAsset {
  return {
    created_at: "2026-01-01T00:00:00Z",
    favorite: false,
    filename: "report.pdf",
    folder_id: folderId,
    id,
    kind: "document",
    mime_type: "application/pdf",
    mode: "drive",
    processing_state: "blob_stored",
    sha256: "abc",
    size_bytes: 10,
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function driveApiMock(overrides: Partial<DriveApi> = {}): DriveApi {
  return {
    createFolder: vi.fn(async ({ name, parentId }) => folder(`folder_${name}`, name, parentId)),
    deleteAsset: vi.fn(),
    deleteFolder: vi.fn(),
    downloadUrl: vi.fn(),
    listItems: vi.fn(async () => ({ breadcrumbs: [], items: [], next_cursor: null })),
    moveAsset: vi.fn(),
    moveFolder: vi.fn(),
    previewUrl: vi.fn(),
    renameAsset: vi.fn(),
    renameFolder: vi.fn(),
    search: vi.fn(),
    thumbnailUrl: vi.fn(),
    uploadFiles: vi.fn(async () => []),
    ...overrides,
  };
}
