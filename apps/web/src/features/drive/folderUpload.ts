import type { DriveApi, DriveAsset, DriveFolder } from "../../api/drive";

export type UploadFileEntry = {
  file: File;
  relativePath: string;
};

export type UploadSelection = {
  directories: string[];
  files: UploadFileEntry[];
};

export type UploadPhase = "preparing" | "uploading";

export type UploadProgress = {
  completedFiles: number;
  currentPath: string | null;
  phase: UploadPhase;
  totalDirectories: number;
  totalFiles: number;
};

export type UploadFailure = {
  error: Error;
  relativePath: string;
};

export type UploadSummary = {
  failures: UploadFailure[];
  skippedDuplicates: number;
  uploaded: number;
};

type FileSystemEntryLike = {
  isDirectory: boolean;
  isFile: boolean;
  name: string;
};

type FileSystemFileEntryLike = FileSystemEntryLike & {
  file: (success: (file: File) => void, error?: (error: DOMException) => void) => void;
};

type FileSystemDirectoryEntryLike = FileSystemEntryLike & {
  createReader: () => {
    readEntries: (
      success: (entries: FileSystemEntryLike[]) => void,
      error?: (error: DOMException) => void,
    ) => void;
  };
};

type EntryDataTransferItem = DataTransferItem & {
  getAsEntry?: () => FileSystemEntryLike | null;
  webkitGetAsEntry?: () => FileSystemEntryLike | null;
};

export async function selectionFromDataTransfer(dataTransfer: DataTransfer): Promise<UploadSelection> {
  const entries = Array.from(dataTransfer.items ?? [])
    .filter((item) => item.kind === "file")
    .map((item) => entryFromDataTransferItem(item))
    .filter((entry): entry is FileSystemEntryLike => entry !== null);

  if (entries.length === 0) {
    return selectionFromFiles(Array.from(dataTransfer.files ?? []));
  }

  const directories = new Set<string>();
  const files: UploadFileEntry[] = [];

  for (const entry of entries) {
    await walkEntry(entry, "", directories, files);
  }

  return normalizedSelection(directories, files);
}

export function selectionFromFiles(files: File[]): UploadSelection {
  const directories = new Set<string>();
  const entries = files.map((file) => {
    const browserPath = "webkitRelativePath" in file ? file.webkitRelativePath : "";
    const relativePath = normalizeRelativePath(browserPath || file.name);
    addParentDirectories(relativePath, directories);
    return { file, relativePath };
  });

  return normalizedSelection(directories, entries);
}

export async function uploadSelection(input: {
  api: DriveApi;
  concurrency?: number;
  destinationFolderId: string | null;
  onProgress?: (progress: UploadProgress) => void;
  selection: UploadSelection;
}): Promise<UploadSummary> {
  const { api, destinationFolderId, onProgress, selection } = input;
  const concurrency = Math.max(1, Math.min(input.concurrency ?? 3, 5));
  const directories = allDirectories(selection);
  const folderIds = new Map<string, string | null>([["", destinationFolderId]]);
  const childFolderCache = new Map<string, DriveFolder[]>();

  onProgress?.({
    completedFiles: 0,
    currentPath: null,
    phase: "preparing",
    totalDirectories: directories.length,
    totalFiles: selection.files.length,
  });

  for (const directory of directories) {
    const parts = splitPath(directory);
    const name = parts.at(-1);
    const parentPath = parts.slice(0, -1).join("/");
    const parentId = folderIds.get(parentPath);

    if (!name || parentId === undefined) {
      throw new Error(`Invalid folder path: ${directory}`);
    }

    const siblings = await listChildFolders(api, parentId, childFolderCache);
    let folder = siblings.find((candidate) => candidate.name === name);
    if (!folder) {
      folder = await api.createFolder({ name, parentId });
      siblings.push(folder);
    }
    folderIds.set(directory, folder.id);
  }

  const failures: UploadFailure[] = [];
  let completedFiles = 0;
  let skippedDuplicates = 0;
  let uploaded = 0;
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < selection.files.length) {
      const index = nextIndex;
      nextIndex += 1;
      const entry = selection.files[index];
      const parentPath = splitPath(entry.relativePath).slice(0, -1).join("/");
      const targetFolderId = folderIds.get(parentPath);

      onProgress?.({
        completedFiles,
        currentPath: entry.relativePath,
        phase: "uploading",
        totalDirectories: directories.length,
        totalFiles: selection.files.length,
      });

      try {
        if (targetFolderId === undefined) {
          throw new Error(`Missing destination folder for ${entry.relativePath}`);
        }
        const [asset] = await api.uploadFiles({ files: [entry.file], folderId: targetFolderId });
        if (isDuplicateOutsideDestination(asset, targetFolderId)) {
          skippedDuplicates += 1;
        } else {
          uploaded += 1;
        }
      } catch (error) {
        failures.push({ error: asError(error), relativePath: entry.relativePath });
      } finally {
        completedFiles += 1;
        onProgress?.({
          completedFiles,
          currentPath: entry.relativePath,
          phase: "uploading",
          totalDirectories: directories.length,
          totalFiles: selection.files.length,
        });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, selection.files.length) }, () => worker()));
  return { failures, skippedDuplicates, uploaded };
}

function entryFromDataTransferItem(item: DataTransferItem): FileSystemEntryLike | null {
  const compatibleItem = item as EntryDataTransferItem;
  return compatibleItem.getAsEntry?.() ?? compatibleItem.webkitGetAsEntry?.() ?? null;
}

async function walkEntry(
  entry: FileSystemEntryLike,
  parentPath: string,
  directories: Set<string>,
  files: UploadFileEntry[],
): Promise<void> {
  const relativePath = normalizeRelativePath(parentPath ? `${parentPath}/${entry.name}` : entry.name);

  if (entry.isFile) {
    const file = await fileFromEntry(entry as FileSystemFileEntryLike);
    files.push({ file, relativePath });
    return;
  }

  if (!entry.isDirectory) {
    return;
  }

  directories.add(relativePath);
  const children = await entriesFromDirectory(entry as FileSystemDirectoryEntryLike);
  for (const child of children) {
    await walkEntry(child, relativePath, directories, files);
  }
}

function fileFromEntry(entry: FileSystemFileEntryLike): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

async function entriesFromDirectory(entry: FileSystemDirectoryEntryLike): Promise<FileSystemEntryLike[]> {
  const reader = entry.createReader();
  const entries: FileSystemEntryLike[] = [];

  while (true) {
    const batch = await new Promise<FileSystemEntryLike[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (batch.length === 0) {
      return entries;
    }
    entries.push(...batch);
  }
}

function normalizedSelection(directories: Set<string>, files: UploadFileEntry[]): UploadSelection {
  return {
    directories: Array.from(directories).sort(comparePaths),
    files: files.sort((left, right) => left.relativePath.localeCompare(right.relativePath, "es")),
  };
}

function allDirectories(selection: UploadSelection): string[] {
  const directories = new Set(selection.directories.map(normalizeRelativePath));
  for (const entry of selection.files) {
    addParentDirectories(entry.relativePath, directories);
  }
  return Array.from(directories).filter(Boolean).sort(comparePaths);
}

function addParentDirectories(path: string, directories: Set<string>) {
  const parts = splitPath(path).slice(0, -1);
  for (let index = 1; index <= parts.length; index += 1) {
    directories.add(parts.slice(0, index).join("/"));
  }
}

function normalizeRelativePath(path: string): string {
  const parts = path.replaceAll("\\", "/").split("/").filter((part) => part && part !== ".");
  if (parts.some((part) => part === "..")) {
    throw new Error("Parent path segments are not allowed");
  }
  return parts.join("/");
}

function splitPath(path: string): string[] {
  return normalizeRelativePath(path).split("/").filter(Boolean);
}

function comparePaths(left: string, right: string): number {
  const depthDifference = splitPath(left).length - splitPath(right).length;
  return depthDifference || left.localeCompare(right, "es");
}

async function listChildFolders(
  api: DriveApi,
  parentId: string | null,
  cache: Map<string, DriveFolder[]>,
): Promise<DriveFolder[]> {
  const cacheKey = parentId ?? "__root__";
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const folders: DriveFolder[] = [];
  let cursor: string | null = null;
  do {
    const page = await api.listItems({ cursor, folderId: parentId, limit: 100 });
    folders.push(...page.items.filter((item) => item.type === "folder").map((item) => item.folder));
    cursor = page.next_cursor;
  } while (cursor);

  cache.set(cacheKey, folders);
  return folders;
}

function isDuplicateOutsideDestination(asset: DriveAsset | undefined, folderId: string | null): boolean {
  return Boolean(asset?.duplicate && asset.folder_id !== folderId);
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
