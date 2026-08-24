import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, FormEvent, ReactNode } from "react";

import type { DriveApi, DriveBreadcrumb } from "../../api/drive";
import { driveApi } from "../../api/drive";
import { Breadcrumb } from "../../components/Breadcrumb";
import { Button } from "../../components/Button";
import { Dialog } from "../../components/Dialog";
import { EmptyState, ErrorState, LoadingState } from "../../components/States";
import { Input } from "../../components/Input";
import { Menu } from "../../components/Menu";
import { SegmentedControl } from "../../components/SegmentedControl";
import { VirtualGrid } from "../../components/VirtualGrid";
import { VirtualList } from "../../components/VirtualList";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "../../components/ui/context-menu";
import { cx } from "../../lib/cx";
import { t } from "../../i18n/dictionary";
import { entryFromItem, entryFromSearchItem, formatBytes, isIndexingState, isPartialFailureState } from "./driveModel";
import type { DriveEntry } from "./driveModel";
import { FileTypeIcon } from "./FileTypeIcon";
import { getFileTypeKind } from "./fileType";
import { FolderTree } from "./FolderTree";
import { selectionFromDataTransfer, selectionFromFiles, uploadSelection } from "./folderUpload";
import type { UploadProgress, UploadSummary } from "./folderUpload";
import { deleteDriveEntries, downloadDriveEntries, downloadableDriveEntries, moveDriveEntries } from "./bulkOperations";
import { useDriveItems, useDriveSearch } from "./useDriveQueries";

type LayoutMode = "grid" | "list";

type PendingAction =
  | { type: "create-folder" }
  | { entries: DriveEntry[]; type: "bulk-delete" }
  | { entries: DriveEntry[]; type: "bulk-move" }
  | { entry: DriveEntry; type: "delete" }
  | { entry: DriveEntry; type: "move" }
  | { entry: DriveEntry; type: "rename" }
  | { entry: DriveEntry; type: "preview" };

export type DriveBrowserProps = {
  api?: DriveApi;
  initialFolderId?: string | null;
  onNavigate?: (folderId: string | null) => void;
};

export function DriveBrowser({ api = driveApi, initialFolderId = null, onNavigate }: DriveBrowserProps) {
  const [folderId, setFolderId] = useState<string | null>(initialFolderId);
  const [layout, setLayout] = useState<LayoutMode>("grid");
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadSummary, setUploadSummary] = useState<UploadSummary | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [dialogValue, setDialogValue] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
  const uploading = uploadProgress !== null;

  const itemsState = useDriveItems(api, folderId, reloadKey);
  const searchState = useDriveSearch(api, folderId, submittedQuery, reloadKey);
  const entries = useMemo(() => (itemsState.data?.items ?? []).map(entryFromItem), [itemsState.data]);
  const searchEntries = useMemo(() => (searchState.data?.items ?? []).map(entryFromSearchItem), [searchState.data]);
  const showingSearch = submittedQuery.trim().length > 0;
  const visibleEntries = showingSearch ? searchEntries : entries;
  const selectedEntries = useMemo(
    () => visibleEntries.filter((entry) => selectedKeys.has(entryKey(entry))),
    [selectedKeys, visibleEntries],
  );
  const downloadableEntries = useMemo(() => downloadableDriveEntries(selectedEntries), [selectedEntries]);
  const allVisibleSelected = visibleEntries.length > 0 && selectedEntries.length === visibleEntries.length;
  const someVisibleSelected = selectedEntries.length > 0 && !allVisibleSelected;
  const breadcrumbs = useMemo(
    () => normalizeBreadcrumbs(itemsState.data?.breadcrumbs, folderId),
    [folderId, itemsState.data?.breadcrumbs],
  );

  function navigate(nextFolderId: string | null) {
    setFolderId(nextFolderId);
    setSubmittedQuery("");
    setQuery("");
    setSelectedKeys(new Set());
    onNavigate?.(nextFolderId);
  }

  function toggleSelection(entry: DriveEntry) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      const key = entryKey(entry);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedKeys(allVisibleSelected ? new Set() : new Set(visibleEntries.map(entryKey)));
  }

  function clearSelection() {
    setSelectedKeys(new Set());
  }

  async function reload() {
    setReloadKey((current) => current + 1);
    await itemsState.refetch();
    if (submittedQuery) {
      await searchState.refetch();
    }
  }

  async function startUpload(selection: ReturnType<typeof selectionFromFiles>) {
    if (selection.files.length === 0 && selection.directories.length === 0) {
      return;
    }

    setUploadSummary(null);
    setUploadError(null);
    setUploadProgress({
      completedFiles: 0,
      currentPath: null,
      phase: "preparing",
      totalDirectories: selection.directories.length,
      totalFiles: selection.files.length,
    });
    try {
      const summary = await uploadSelection({
        api,
        destinationFolderId: folderId,
        onProgress: setUploadProgress,
        selection,
      });
      setUploadSummary(summary);
      await reload();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : t("drive.error.action"));
    } finally {
      setUploadProgress(null);
    }
  }

  async function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    dragDepthRef.current = 0;
    setDragActive(false);
    setUploadError(null);
    try {
      const selection = await selectionFromDataTransfer(event.dataTransfer);
      await startUpload(selection);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : t("drive.upload.readError"));
    }
  }

  function openAction(action: PendingAction) {
    setPendingAction(action);
    setActionError(null);
    if (action.type === "rename") {
      setDialogValue(action.entry.name);
    } else {
      setDialogValue("");
    }
  }

  async function submitAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

      if (!pendingAction) {
      return;
    }

    const value = dialogValue.trim();
    setActionError(null);

    try {
      if (pendingAction.type === "rename") {
        if (!value) {
          setActionError(t("drive.validation.nameRequired"));
          return;
        }
        if (pendingAction.entry.kind === "folder") {
          await api.renameFolder({ folderId: pendingAction.entry.id, name: value });
        } else {
          await api.renameAsset({ assetId: pendingAction.entry.id, name: value });
        }
      }

      if (pendingAction.type === "create-folder") {
        if (!value) {
          setActionError(t("drive.validation.nameRequired"));
          return;
        }
        await api.createFolder({ name: value, parentId: folderId });
      }

      if (pendingAction.type === "move") {
        const targetId = value || null;
        if (pendingAction.entry.kind === "folder") {
          await api.moveFolder({ folderId: pendingAction.entry.id, parentId: targetId });
        } else {
          await api.moveAsset({ assetId: pendingAction.entry.id, folderId: targetId });
        }
      }

      if (pendingAction.type === "delete") {
        if (pendingAction.entry.kind === "folder") {
          await api.deleteFolder(pendingAction.entry.id);
        } else {
          await api.deleteAsset(pendingAction.entry.id);
        }
      }

      if (pendingAction.type === "bulk-move") {
        await moveDriveEntries(api, pendingAction.entries, value || null);
        clearSelection();
      }

      if (pendingAction.type === "bulk-delete") {
        await deleteDriveEntries(api, pendingAction.entries);
        clearSelection();
      }

      setPendingAction(null);
      await reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t("drive.error.action"));
    }
  }

  return (
    <section
      aria-labelledby="drive-title"
      className="relative grid gap-4"
      onDragLeave={(event) => {
        event.preventDefault();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) {
          setDragActive(false);
        }
      }}
      onDragEnter={(event) => {
        event.preventDefault();
        dragDepthRef.current += 1;
        setDragActive(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(event) => void onDrop(event)}
    >
      {dragActive ? <DropOverlay /> : null}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-app-border/80 pb-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-app-text" id="drive-title">
            {t("drive.title")}
          </h1>
          <div className="mt-2.5">
            <Breadcrumb
              items={breadcrumbs.map((item) => ({
                current: item.folder_id === folderId,
                href: item.folder_id ? `/drive/folders/${item.folder_id}` : "/drive",
                label: item.name,
                onNavigate: () => navigate(item.folder_id),
              }))}
              label={t("drive.breadcrumb.label")}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3.5">
          <SegmentedControl
            ariaLabel={t("drive.layout.label")}
            onChange={setLayout}
            options={[
              { label: t("drive.layout.grid"), value: "grid" },
              { label: t("drive.layout.list"), value: "list" },
            ]}
            value={layout}
          />
          <Button disabled={uploading} onClick={() => fileInputRef.current?.click()} variant="primary" className="cursor-pointer font-semibold shadow-sm">
            {t("drive.upload.pick")}
          </Button>
          <Button
            disabled={uploading}
            onClick={() => folderInputRef.current?.click()}
            variant="secondary"
            className="cursor-pointer font-semibold shadow-sm"
          >
            {t("drive.upload.pickFolder")}
          </Button>
          <input
            aria-hidden="true"
            className="hidden"
            data-testid="drive-file-input"
            disabled={uploading}
            multiple
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = "";
              void startUpload(selectionFromFiles(files));
            }}
            ref={fileInputRef}
            tabIndex={-1}
            type="file"
          />
          <input
            aria-hidden="true"
            className="hidden"
            data-testid="drive-folder-input"
            disabled={uploading}
            multiple
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = "";
              void startUpload(selectionFromFiles(files));
            }}
            ref={(element) => {
              folderInputRef.current = element;
              element?.setAttribute("webkitdirectory", "");
              element?.setAttribute("directory", "");
            }}
            tabIndex={-1}
            type="file"
          />
        </div>
      </div>

      <UploadStatusPanel
        error={uploadError}
        onDismiss={() => {
          setUploadError(null);
          setUploadSummary(null);
        }}
        progress={uploadProgress}
        summary={uploadSummary}
      />

      <div className="grid min-h-0 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <FolderTree
          api={api}
          breadcrumbs={breadcrumbs}
          currentFolderId={folderId}
          onNavigate={navigate}
          reloadKey={reloadKey}
        />

        <div className="grid min-w-0 content-start gap-4">
          <div className="rounded-app-card border border-dashed border-app-border bg-gradient-to-br from-app-surface to-app-accent-muted/25 p-4 shadow-2xs">
            <div className="flex flex-wrap items-end gap-3.5">
              <form
                className="min-w-56 flex-1"
                onSubmit={(event) => {
                  event.preventDefault();
                  clearSelection();
                  setSubmittedQuery(query);
                }}
                role="search"
              >
                <Input
                  label={t("drive.search.label")}
                  onChange={(event) => setQuery(event.currentTarget.value)}
                  placeholder={t("drive.search.placeholder")}
                  type="search"
                  value={query}
                />
              </form>
              <Button
                onClick={() => {
                  clearSelection();
                  setSubmittedQuery(query);
                }}
                className="cursor-pointer font-semibold shadow-2xs"
              >
                {t("drive.search.submit")}
              </Button>
              {showingSearch ? (
                <Button
                  onClick={() => {
                    setQuery("");
                    setSubmittedQuery("");
                    clearSelection();
                  }}
                  variant="ghost"
                  className="cursor-pointer font-semibold"
                >
                  {t("drive.search.clear")}
                </Button>
              ) : null}
              <Button
                onClick={() => {
                  setDialogValue("");
                  setPendingAction({ type: "create-folder" });
                }}
                variant="secondary"
                className="cursor-pointer font-semibold shadow-2xs"
              >
                {t("drive.folder.new")}
              </Button>
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm text-app-text-muted/95">
              <UploadCloudIcon />
              <p>{t("drive.upload.dropHint")}</p>
            </div>
          </div>

          {visibleEntries.length > 0 ? (
            <SelectionToolbar
              allVisibleSelected={allVisibleSelected}
              downloadableCount={downloadableEntries.length}
              onBulkDelete={() => openAction({ entries: selectedEntries, type: "bulk-delete" })}
              onBulkDownload={() => downloadDriveEntries(api, selectedEntries, openInNewTab)}
              onBulkMove={() => openAction({ entries: selectedEntries, type: "bulk-move" })}
              onClear={clearSelection}
              onToggleAll={toggleAllVisible}
              selectedCount={selectedEntries.length}
              someVisibleSelected={someVisibleSelected}
            />
          ) : null}

          {actionError ? <ErrorState body={actionError} title={t("drive.error.title")} /> : null}
          {itemsState.loading && !itemsState.data ? <LoadingState label={t("drive.loading")} /> : null}
          {itemsState.error ? (
            <ErrorState body={itemsState.error.message} onRetry={() => void itemsState.refetch()} title={t("drive.error.title")} />
          ) : null}
          {searchState.loading ? <LoadingState label={t("drive.search.loading")} /> : null}
          {searchState.error ? (
            <ErrorState
              body={searchState.error.message}
              onRetry={() => void searchState.refetch()}
              title={t("drive.error.title")}
            />
          ) : null}

          {!itemsState.loading && !itemsState.error && visibleEntries.length === 0 ? (
            <EmptyState
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button disabled={uploading} onClick={() => fileInputRef.current?.click()} variant="primary" className="shadow-sm font-semibold">
                    {t("drive.upload.pick")}
                  </Button>
                  <Button disabled={uploading} onClick={() => folderInputRef.current?.click()} variant="secondary" className="shadow-sm font-semibold">
                    {t("drive.upload.pickFolder")}
                  </Button>
                </div>
              }
              body={showingSearch ? t("drive.empty.searchBody") : t("drive.empty.body")}
              title={showingSearch ? t("drive.empty.searchTitle") : t("drive.empty.title")}
            />
          ) : null}

          {visibleEntries.length > 0 && layout === "grid" ? (
            <VirtualGrid
              className="rounded-none border-0 bg-transparent"
              gap={24}
              getKey={(entry) => `${entry.kind}-${entry.id}`}
              height={560}
              items={visibleEntries}
              minColumnWidth={176}
              renderItem={(entry) => (
                <DriveGridCard
                  api={api}
                  entry={entry}
                  onNavigate={navigate}
                  onOpenAction={openAction}
                  onToggleSelection={toggleSelection}
                  searchMode={showingSearch}
                  selected={selectedKeys.has(entryKey(entry))}
                />
              )}
              rowHeight={218}
            />
          ) : null}

          {visibleEntries.length > 0 && layout === "list" ? (
            <VirtualList
              estimateSize={84}
              getKey={(entry) => `${entry.kind}-${entry.id}`}
              height={560}
              items={visibleEntries}
              renderItem={(entry) => (
                <DriveListRow
                  api={api}
                  entry={entry}
                  onNavigate={navigate}
                  onOpenAction={openAction}
                  onToggleSelection={toggleSelection}
                  searchMode={showingSearch}
                  selected={selectedKeys.has(entryKey(entry))}
                />
              )}
            />
          ) : null}
        </div>
      </div>

      <ActionDialog
        action={pendingAction}
        api={api}
        error={actionError}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAction(null);
            setActionError(null);
          }
        }}
        onSubmit={submitAction}
        setValue={setDialogValue}
        value={dialogValue}
      />
    </section>
  );
}

function DropOverlay() {
  return (
    <div
      aria-live="assertive"
      className="pointer-events-none absolute inset-0 z-40 grid min-h-72 place-items-center rounded-2xl border-2 border-dashed border-app-accent bg-white/95 p-8 text-center shadow-app-dialog backdrop-blur-sm"
      role="status"
    >
      <div className="max-w-md">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-app-accent text-white shadow-lg shadow-teal-900/15">
          <UploadCloudIcon className="h-8 w-8" />
        </span>
        <p className="mt-5 text-xl font-bold tracking-tight text-app-text">{t("drive.upload.dropTitle")}</p>
        <p className="mt-2 text-sm leading-relaxed text-app-text-muted">{t("drive.upload.dropBody")}</p>
      </div>
    </div>
  );
}

function UploadStatusPanel({
  error,
  onDismiss,
  progress,
  summary,
}: {
  error: string | null;
  onDismiss: () => void;
  progress: UploadProgress | null;
  summary: UploadSummary | null;
}) {
  if (!progress && !summary && !error) {
    return null;
  }

  const percent = progress
    ? progress.phase === "preparing"
      ? 8
      : progress.totalFiles > 0
        ? Math.round((progress.completedFiles / progress.totalFiles) * 100)
        : 100
    : 100;

  return (
    <section
      aria-live="polite"
      className={cx(
        "rounded-app-card border p-4 shadow-sm",
        error || summary?.failures.length ? "border-red-200 bg-red-50/60" : "border-teal-200 bg-teal-50/70",
      )}
      role={error ? "alert" : "status"}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold text-app-text">
              {progress
                ? progress.phase === "preparing"
                  ? t("drive.upload.preparing")
                  : t("drive.upload.uploading")
                : error
                  ? t("drive.upload.failed")
                  : t("drive.upload.complete")}
            </h2>
            {progress ? <span className="text-sm font-bold tabular-nums text-teal-800">{percent}%</span> : null}
          </div>
          {progress ? (
            <>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white shadow-inner" aria-hidden="true">
                <div className="h-full rounded-full bg-app-accent transition-[width] duration-150" style={{ width: `${percent}%` }} />
              </div>
              <p className="mt-2 truncate text-sm text-app-text-muted">
                {progress.phase === "preparing"
                  ? `${progress.totalDirectories} ${t("drive.upload.foldersToCreate")}`
                  : `${progress.completedFiles} ${t("drive.upload.of")} ${progress.totalFiles} · ${progress.currentPath ?? ""}`}
              </p>
            </>
          ) : null}
          {summary ? (
            <p className="mt-1 text-sm text-app-text-muted">
              {summary.uploaded} {t("drive.upload.uploadedCount")} · {summary.skippedDuplicates} {t("drive.upload.duplicateCount")} ·{" "}
              {summary.failures.length} {t("drive.upload.failedCount")}
            </p>
          ) : null}
          {error ? <p className="mt-1 text-sm text-app-danger">{error}</p> : null}
          {summary?.failures.slice(0, 3).map((failure) => (
            <p className="mt-1 truncate text-xs text-app-danger" key={failure.relativePath}>
              {failure.relativePath}: {failure.error.message}
            </p>
          ))}
        </div>
        {!progress ? (
          <button
            aria-label={t("common.close")}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-app-text-muted hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-app-accent"
            onClick={onDismiss}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        ) : null}
      </div>
    </section>
  );
}

function UploadCloudIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={cx(className, "shrink-0")} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M7 18a4.6 4.6 0 0 1-.5-9.2A6 6 0 0 1 18 10.5a3.8 3.8 0 0 1-.5 7.5H7Z" />
      <path d="m9 13 3-3 3 3M12 10v7" />
    </svg>
  );
}

function SelectionToolbar({
  allVisibleSelected,
  downloadableCount,
  onBulkDelete,
  onBulkDownload,
  onBulkMove,
  onClear,
  onToggleAll,
  selectedCount,
  someVisibleSelected,
}: {
  allVisibleSelected: boolean;
  downloadableCount: number;
  onBulkDelete: () => void;
  onBulkDownload: () => void;
  onBulkMove: () => void;
  onClear: () => void;
  onToggleAll: () => void;
  selectedCount: number;
  someVisibleSelected: boolean;
}) {
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  return (
    <section
      aria-label={t("drive.selection.label")}
      className="flex flex-wrap items-center justify-between gap-3 rounded-app-control border border-app-border/80 bg-app-surface/80 px-3 py-2.5"
    >
      <label className="inline-flex min-h-8 items-center gap-2 text-sm font-semibold text-app-text">
        <input
          aria-label={t("drive.selection.all")}
          checked={allVisibleSelected}
          className="h-4 w-4 cursor-pointer accent-teal-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent"
          onChange={onToggleAll}
          ref={selectAllRef}
          type="checkbox"
        />
        <span>
          {selectedCount > 0 ? `${selectedCount} ${t("drive.selection.count")}` : t("drive.selection.all")}
        </span>
      </label>

      {selectedCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button aria-label={t("drive.action.bulkMove")} className="h-8 px-3 text-xs" onClick={onBulkMove}>
            {t("drive.action.bulkMove")}
          </Button>
          {downloadableCount > 0 ? (
            <Button aria-label={t("drive.action.bulkDownload")} className="h-8 px-3 text-xs" onClick={onBulkDownload}>
              {t("drive.action.bulkDownload")}
            </Button>
          ) : null}
          <Button aria-label={t("drive.action.bulkDelete")} className="h-8 px-3 text-xs" onClick={onBulkDelete} variant="danger">
            {t("drive.action.bulkDelete")}
          </Button>
          <Button aria-label={t("drive.selection.clear")} className="h-8 px-3 text-xs" onClick={onClear} variant="ghost">
            {t("drive.selection.clear")}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

type EntryCardProps = {
  api: DriveApi;
  entry: DriveEntry;
  onNavigate: (folderId: string | null) => void;
  onOpenAction: (action: PendingAction) => void;
  onToggleSelection: (entry: DriveEntry) => void;
  searchMode: boolean;
  selected: boolean;
};

function DriveGridCard({ api, entry, onNavigate, onOpenAction, onToggleSelection, selected }: EntryCardProps) {
  return (
    <DriveContextMenu api={api} entry={entry} onOpenAction={onOpenAction}>
      <article className={cx("group relative flex h-full min-h-0 flex-col", selected && "rounded-sm ring-2 ring-app-accent ring-offset-2 ring-offset-app-bg")}>
        <EntrySelectionCheckbox entry={entry} onToggle={onToggleSelection} selected={selected} />
        <button
          aria-label={`${t("drive.action.open")} ${entry.name}`}
          className="flex min-h-0 min-w-0 flex-1 cursor-pointer flex-col text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent"
          onClick={() => openEntry({ api, entry, onNavigate, onOpenAction })}
          type="button"
        >
          <div className="grid aspect-[4/3] w-full min-h-0 place-items-center overflow-hidden rounded-sm bg-slate-100/45">
            <FileTypeIcon
              mimeType={entry.mimeType}
              name={entry.name}
              previewSrc={entry.thumbnailUrl}
              type={entry.kind}
            />
          </div>
          <h2 className="mt-2 truncate px-1 text-center text-[13px] font-medium leading-5 tracking-tight text-app-text group-hover:text-app-accent">
            {entry.name}
          </h2>
        </button>
        <DriveEntryMenu api={api} compact entry={entry} onOpenAction={onOpenAction} />
      </article>
    </DriveContextMenu>
  );
}

function DriveListRow({ api, entry, onNavigate, onOpenAction, onToggleSelection, searchMode, selected }: EntryCardProps) {
  return (
    <DriveContextMenu api={api} entry={entry} onOpenAction={onOpenAction}>
      <article className={cx("group relative grid h-full grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 border-b border-app-border bg-app-surface px-3 py-1.5 transition-colors duration-150 hover:bg-slate-50", selected && "bg-teal-50/70")}>
        <EntrySelectionCheckbox entry={entry} onToggle={onToggleSelection} selected={selected} />
        <button
          aria-label={`${t("drive.action.open")} ${entry.name}`}
          className="grid h-9 w-9 cursor-pointer place-items-center rounded-app-control bg-slate-50/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-app-accent"
          onClick={() => openEntry({ api, entry, onNavigate, onOpenAction })}
          type="button"
        >
          <FileTypeIcon
            mimeType={entry.mimeType}
            name={entry.name}
            previewSrc={entry.thumbnailUrl}
            size="list"
            type={entry.kind}
          />
        </button>
        <div className="min-w-0 pr-8">
          <h2 className="truncate text-[13px] font-bold tracking-tight text-app-text">{entry.name}</h2>
          <EntryMeta entry={entry} searchMode={searchMode} />
        </div>
        <DriveEntryMenu api={api} compact entry={entry} onOpenAction={onOpenAction} />
      </article>
    </DriveContextMenu>
  );
}

function EntrySelectionCheckbox({
  entry,
  onToggle,
  selected,
}: {
  entry: DriveEntry;
  onToggle: (entry: DriveEntry) => void;
  selected: boolean;
}) {
  return (
    <label
      className={cx(
        "absolute left-2 top-2 z-20 inline-flex cursor-pointer rounded bg-white/90 p-0.5 shadow-sm transition-opacity focus-within:opacity-100",
        selected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
      )}
      onClick={(event) => event.stopPropagation()}
    >
      <input
        aria-label={`${selected ? t("drive.selection.unselect") : t("drive.selection.select")} ${entry.name}`}
        checked={selected}
        className="h-4 w-4 cursor-pointer accent-teal-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent"
        onChange={() => onToggle(entry)}
        type="checkbox"
      />
    </label>
  );
}

function EntryMeta({ entry, searchMode }: { entry: DriveEntry; searchMode: boolean }) {
  const parts = [
    entry.kind === "folder" ? t("drive.item.folder") : entry.mimeType ?? t("drive.item.file"),
    formatBytes(entry.sizeBytes),
  ].filter(Boolean);

  return (
    <div className="mt-0.5 grid gap-0.5 text-[11px] text-app-text-muted">
      <p className="truncate text-app-text-muted/80">{parts.join(" · ")}</p>
      {isIndexingState(entry.processingState) ? (
        <p className="font-semibold text-app-warning">{t("drive.state.indexing")}</p>
      ) : null}
      {isPartialFailureState(entry.processingState) ? (
        <p className="font-semibold text-app-danger">{t("drive.state.partialFailure")}</p>
      ) : null}
      {searchMode && entry.reason ? <p className="truncate text-app-text-muted/70">{entry.reason}</p> : null}
    </div>
  );
}

function entryKey(entry: DriveEntry): string {
  return `${entry.kind}:${entry.id}`;
}

function isInlinePreviewable(entry: DriveEntry): boolean {
  if (entry.kind !== "asset") {
    return false;
  }

  const kind = getFileTypeKind("asset", entry.name, entry.mimeType);
  return kind === "pdf" || kind === "text";
}

function isPreviewable(entry: DriveEntry): boolean {
  if (entry.kind !== "asset") {
    return false;
  }

  return ["image", "pdf", "text", "video"].includes(getFileTypeKind("asset", entry.name, entry.mimeType));
}

function openEntry({
  api,
  entry,
  onNavigate,
  onOpenAction,
}: {
  api: DriveApi;
  entry: DriveEntry;
  onNavigate: (folderId: string | null) => void;
  onOpenAction: (action: PendingAction) => void;
}) {
  if (entry.kind === "folder") {
    onNavigate(entry.id);
  } else if (isPreviewable(entry)) {
    onOpenAction({ entry, type: "preview" });
  } else {
    openInNewTab(api.downloadUrl(entry.id));
  }
}

function openInNewTab(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

type DriveEntryAction = {
  id: string;
  label: string;
  onSelect: () => void;
};

function getDriveEntryActions({
  api,
  entry,
  onOpenAction,
}: {
  api: DriveApi;
  entry: DriveEntry;
  onOpenAction: (action: PendingAction) => void;
}): DriveEntryAction[] {
  return [
    { id: "rename", label: t("drive.action.rename"), onSelect: () => onOpenAction({ entry, type: "rename" }) },
    { id: "move", label: t("drive.action.move"), onSelect: () => onOpenAction({ entry, type: "move" }) },
    { id: "delete", label: t("drive.action.delete"), onSelect: () => onOpenAction({ entry, type: "delete" }) },
    ...(entry.kind === "asset" && isPreviewable(entry)
      ? [{ id: "preview", label: t("drive.action.preview"), onSelect: () => onOpenAction({ entry, type: "preview" }) }]
      : []),
    ...(entry.kind === "asset"
      ? [{ id: "download", label: t("drive.action.download"), onSelect: () => openInNewTab(api.downloadUrl(entry.id)) }]
      : []),
  ];
}

function DriveContextMenu({
  api,
  children,
  entry,
  onOpenAction,
}: {
  api: DriveApi;
  children: ReactNode;
  entry: DriveEntry;
  onOpenAction: (action: PendingAction) => void;
}) {
  const items = getDriveEntryActions({ api, entry, onOpenAction });

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent
        aria-label={`${t("drive.action.menu")} ${entry.name}`}
        className="min-w-48 border-slate-700 bg-slate-950 p-1 text-slate-50 shadow-2xl shadow-slate-950/30"
      >
        {items.map((item) => (
          <ContextMenuItem
            className="h-9 cursor-pointer rounded-app-control px-2.5 text-sm font-medium text-slate-100 hover:bg-slate-800 hover:text-white focus:bg-slate-800 focus:text-white"
            key={item.id}
            onSelect={item.onSelect}
          >
            {item.label}
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}

function DriveEntryMenu({
  api,
  compact = false,
  entry,
  onOpenAction,
}: {
  api: DriveApi;
  compact?: boolean;
  entry: DriveEntry;
  onOpenAction: (action: PendingAction) => void;
}) {
  const items = getDriveEntryActions({ api, entry, onOpenAction });

  return (
    <div
      className={cx(
        compact
          ? "absolute right-1 top-1 z-10 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100 [&>div>button]:h-7 [&>div>button]:w-7 [&>div>button]:border-0 [&>div>button]:bg-transparent [&>div>button]:p-0 [&>div>button]:text-app-text-muted [&>div>button]:shadow-none [&>div>button]:hover:bg-slate-100/80 [&>div>button]:focus-visible:bg-slate-100"
          : "shrink-0",
      )}
    >
      <Menu items={items} label={`${t("drive.action.menu")} ${entry.name}`} trigger={<MoreIcon />} />
    </div>
  );
}

function MoreIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

type ActionDialogProps = {
  action: PendingAction | null;
  api: DriveApi;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  setValue: (value: string) => void;
  value: string;
};

function ActionDialog({ action, api, error, onOpenChange, onSubmit, setValue, value }: ActionDialogProps) {
  if (!action) {
    return null;
  }

  if (action.type === "preview" && action.entry.kind === "asset") {
    if (getFileTypeKind("asset", action.entry.name, action.entry.mimeType) === "image") {
      return <ImageViewerDialog api={api} entry={action.entry} onOpenChange={onOpenChange} />;
    }

    if (isInlinePreviewable(action.entry)) {
      return <AssetPreviewDialog api={api} entry={action.entry} onOpenChange={onOpenChange} />;
    }

    return (
      <Dialog onOpenChange={onOpenChange} open title={action.entry.name}>
        <img alt={action.entry.name} className="max-h-[60vh] w-full object-contain" src={api.previewUrl(action.entry.id)} />
      </Dialog>
    );
  }

  const isBulkDelete = action.type === "bulk-delete";
  const isDelete = isBulkDelete || action.type === "delete";
  const isBulkMove = action.type === "bulk-move";
  const isMove = isBulkMove || action.type === "move";
  const titleKey: Parameters<typeof t>[0] =
    action.type === "create-folder"
      ? "drive.dialog.createFolderTitle"
      : action.type === "rename"
        ? "drive.dialog.renameTitle"
        : isBulkMove
          ? "drive.dialog.bulkMoveTitle"
          : isMove
            ? "drive.dialog.moveTitle"
            : isBulkDelete
              ? "drive.dialog.bulkDeleteTitle"
          : "drive.dialog.deleteTitle";

  return (
    <Dialog
      actions={
        <>
          <Button onClick={() => onOpenChange(false)} variant="ghost">
            {t("drive.dialog.cancel")}
          </Button>
          <Button form="drive-action-form" type="submit" variant={isDelete ? "danger" : "primary"}>
            {isDelete ? t("drive.dialog.deleteConfirm") : t("drive.dialog.save")}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open
      title={t(titleKey)}
    >
      <form className="grid gap-3" id="drive-action-form" onSubmit={onSubmit}>
        {action.type === "rename" || action.type === "create-folder" ? (
          <Input
            autoFocus
            label={t("drive.dialog.nameLabel")}
            onChange={(event) => setValue(event.currentTarget.value)}
            value={value}
          />
        ) : null}
        {isMove ? (
          <Input
            aria-label={t("drive.dialog.folderIdLabel")}
            autoFocus
            hint={t("drive.dialog.moveHint")}
            label={t("drive.dialog.folderIdLabel")}
            onChange={(event) => setValue(event.currentTarget.value)}
            value={value}
          />
        ) : null}
        {isDelete ? <p>{t(isBulkDelete ? "drive.dialog.bulkDeleteBody" : "drive.dialog.deleteBody")}</p> : null}
        {error ? <p className="text-app-danger">{error}</p> : null}
      </form>
    </Dialog>
  );
}

function ImageViewerDialog({
  api,
  entry,
  onOpenChange,
}: {
  api: DriveApi;
  entry: DriveEntry;
  onOpenChange: (open: boolean) => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [onOpenChange]);

  return (
    <div
      aria-labelledby="drive-image-viewer-title"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/92 p-4 backdrop-blur-sm sm:p-8"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onOpenChange(false);
        }
      }}
      role="dialog"
    >
      <h2 className="sr-only" id="drive-image-viewer-title">
        {entry.name}
      </h2>
      <button
        aria-label={t("common.close")}
        className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-2xl leading-none text-white transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white sm:right-6 sm:top-6"
        onClick={() => onOpenChange(false)}
        ref={closeButtonRef}
        type="button"
      >
        <span aria-hidden="true">×</span>
      </button>
      <img
        alt={entry.name}
        className="max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] object-contain sm:max-h-[calc(100vh-4rem)] sm:max-w-[calc(100vw-4rem)]"
        onClick={(event) => event.stopPropagation()}
        src={api.previewUrl(entry.id)}
      />
    </div>
  );
}

type AssetPreviewState =
  | { status: "error" }
  | { status: "loading" }
  | { content: string; status: "text" }
  | { status: "pdf"; url: string };

function AssetPreviewDialog({
  api,
  entry,
  onOpenChange,
}: {
  api: DriveApi;
  entry: DriveEntry;
  onOpenChange: (open: boolean) => void;
}) {
  const kind = getFileTypeKind("asset", entry.name, entry.mimeType);
  const [state, setState] = useState<AssetPreviewState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;
    let cancelled = false;

    setState({ status: "loading" });
    void (async () => {
      try {
        const response = await fetch(api.downloadUrl(entry.id), { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Preview request failed with status ${response.status}`);
        }

        if (kind === "text") {
          const content = await response.text();
          if (!cancelled) {
            setState({ content, status: "text" });
          }
          return;
        }

        const blob = await response.blob();
        if (typeof URL.createObjectURL !== "function") {
          throw new Error("PDF preview is not supported in this browser");
        }
        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          revokeObjectUrl(objectUrl);
          return;
        }
        setState({ status: "pdf", url: objectUrl });
      } catch {
        if (!controller.signal.aborted && !cancelled) {
          setState({ status: "error" });
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      if (objectUrl) {
        revokeObjectUrl(objectUrl);
      }
    };
  }, [api, entry.id, kind]);

  return (
    <Dialog onOpenChange={onOpenChange} open title={entry.name}>
      {state.status === "loading" ? <LoadingState label={t("drive.preview.loading")} /> : null}
      {state.status === "error" ? <ErrorState body={t("drive.preview.error")} title={t("drive.error.title")} /> : null}
      {state.status === "text" ? (
        <pre
          aria-label={entry.name}
          className="max-h-[60vh] overflow-auto rounded-app-control border border-app-border bg-slate-950 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-slate-100"
        >
          {state.content || t("drive.preview.empty")}
        </pre>
      ) : null}
      {state.status === "pdf" ? (
        <iframe
          className="h-[min(64vh,42rem)] w-full rounded-app-control border border-app-border bg-slate-100"
          title={`${entry.name} · ${t("drive.action.preview")}`}
          src={state.url}
        />
      ) : null}
    </Dialog>
  );
}

function revokeObjectUrl(url: string) {
  if (typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(url);
  }
}

function normalizeBreadcrumbs(items: DriveBreadcrumb[] | undefined, folderId: string | null): DriveBreadcrumb[] {
  if (items && items.length > 0) {
    return [{ folder_id: null, name: t("drive.root") }, ...items.filter((item) => item.folder_id !== null)];
  }

  return [
    { folder_id: null, name: t("drive.root") },
    ...(folderId ? [{ folder_id: folderId, name: t("drive.currentFolder") }] : []),
  ];
}
