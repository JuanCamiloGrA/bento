import { useMemo, useRef, useState } from "react";
import type { DragEvent, FormEvent } from "react";

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
import { cx } from "../../lib/cx";
import { t } from "../../i18n/dictionary";
import { entryFromItem, entryFromSearchItem, formatBytes, isIndexingState, isPartialFailureState } from "./driveModel";
import type { DriveEntry } from "./driveModel";
import { FileTypeIcon } from "./FileTypeIcon";
import { FolderTree } from "./FolderTree";
import { selectionFromDataTransfer, selectionFromFiles, uploadSelection } from "./folderUpload";
import type { UploadProgress, UploadSummary } from "./folderUpload";
import { useDriveItems, useDriveSearch } from "./useDriveQueries";

type LayoutMode = "grid" | "list";

type PendingAction =
  | { type: "create-folder" }
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
  const breadcrumbs = useMemo(
    () => normalizeBreadcrumbs(itemsState.data?.breadcrumbs, folderId),
    [folderId, itemsState.data?.breadcrumbs],
  );

  function navigate(nextFolderId: string | null) {
    setFolderId(nextFolderId);
    setSubmittedQuery("");
    setQuery("");
    onNavigate?.(nextFolderId);
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
              <Button onClick={() => setSubmittedQuery(query)} className="cursor-pointer font-semibold shadow-2xs">
                {t("drive.search.submit")}
              </Button>
              {showingSearch ? (
                <Button
                  onClick={() => {
                    setQuery("");
                    setSubmittedQuery("");
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
              getKey={(entry) => `${entry.kind}-${entry.id}`}
              height={560}
              items={visibleEntries}
              minColumnWidth={168}
              renderItem={(entry) => (
                <DriveGridCard api={api} entry={entry} onNavigate={navigate} onOpenAction={openAction} searchMode={showingSearch} />
              )}
              rowHeight={216}
            />
          ) : null}

          {visibleEntries.length > 0 && layout === "list" ? (
            <VirtualList
              estimateSize={84}
              getKey={(entry) => `${entry.kind}-${entry.id}`}
              height={560}
              items={visibleEntries}
              renderItem={(entry) => (
                <DriveListRow api={api} entry={entry} onNavigate={navigate} onOpenAction={openAction} searchMode={showingSearch} />
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

type EntryCardProps = {
  api: DriveApi;
  entry: DriveEntry;
  onNavigate: (folderId: string | null) => void;
  onOpenAction: (action: PendingAction) => void;
  searchMode: boolean;
};

function DriveGridCard({ api, entry, onNavigate, onOpenAction, searchMode }: EntryCardProps) {
  return (
    <article className="grid h-full min-h-0 grid-rows-[88px_minmax(0,1fr)_auto] gap-2 rounded-app-card border border-app-border bg-app-surface p-2.5 shadow-2xs transition-all duration-200 hover:border-slate-300 hover:shadow-sm group">
      <button
        aria-label={entry.name}
        className="grid min-w-0 place-items-center overflow-hidden rounded-app-control bg-slate-50/75 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent cursor-pointer"
        onClick={() => {
          if (entry.kind === "folder") {
            onNavigate(entry.id);
          }
        }}
        type="button"
      >
        <FileTypeIcon
          mimeType={entry.mimeType}
          name={entry.name}
          previewSrc={entry.thumbnailUrl}
          type={entry.kind}
        />
      </button>
      <div className="min-w-0">
        <h2 className="truncate text-[13px] font-bold tracking-tight text-app-text transition-colors group-hover:text-app-accent">{entry.name}</h2>
        <EntryMeta entry={entry} searchMode={searchMode} />
      </div>
      <EntryActions api={api} entry={entry} onOpenAction={onOpenAction} />
    </article>
  );
}

function DriveListRow({ api, entry, onNavigate, onOpenAction, searchMode }: EntryCardProps) {
  return (
    <article className="grid h-full grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 border-b border-app-border bg-app-surface px-3 py-1.5 transition-colors duration-150 hover:bg-slate-50">
      <button
        aria-label={entry.name}
        className="grid h-9 w-9 place-items-center rounded-app-control bg-slate-50/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-app-accent cursor-pointer"
        onClick={() => {
          if (entry.kind === "folder") {
            onNavigate(entry.id);
          }
        }}
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
      <div className="min-w-0">
        <h2 className="truncate text-[13px] font-bold tracking-tight text-app-text">{entry.name}</h2>
        <EntryMeta entry={entry} searchMode={searchMode} />
      </div>
      <EntryActions api={api} entry={entry} onOpenAction={onOpenAction} />
    </article>
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

function EntryActions({ api, entry, onOpenAction }: Omit<EntryCardProps, "onNavigate" | "searchMode">) {
  const items = [
    { id: "rename", label: t("drive.action.rename"), onSelect: () => onOpenAction({ entry, type: "rename" }) },
    { id: "move", label: t("drive.action.move"), onSelect: () => onOpenAction({ entry, type: "move" }) },
    { id: "delete", label: t("drive.action.delete"), onSelect: () => onOpenAction({ entry, type: "delete" }) },
  ];

  return (
    <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-app-border/40 pt-1.5 transition-colors group-hover:border-slate-300">
      {entry.kind === "asset" ? (
        <div className="flex min-w-0 items-center gap-1.5">
          <a
            className="truncate rounded-app-control border border-app-border bg-app-surface px-1.5 py-0.5 text-[11px] font-semibold text-app-accent transition-all duration-150 hover:bg-slate-50 active:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-app-accent"
            href={api.previewUrl(entry.id)}
            target="_blank"
          >
            {t("drive.action.preview")}
          </a>
          <a
            className="truncate rounded-app-control border border-app-border bg-app-surface px-1.5 py-0.5 text-[11px] font-semibold text-app-accent transition-all duration-150 hover:bg-slate-50 active:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-app-accent"
            download
            href={api.downloadUrl(entry.id)}
          >
            {t("drive.action.download")}
          </a>
        </div>
      ) : (
        <span className="text-[11px] font-medium text-app-text-muted/80">{t("drive.item.folder")}</span>
      )}
      <Menu items={items} label={`${t("drive.action.menu")} ${entry.name}`} trigger={<span>...</span>} />
    </div>
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
    return (
      <Dialog onOpenChange={onOpenChange} open title={action.entry.name}>
        <img alt={action.entry.name} className="max-h-[60vh] w-full object-contain" src={api.previewUrl(action.entry.id)} />
      </Dialog>
    );
  }

  const titleKey: Parameters<typeof t>[0] =
    action.type === "create-folder"
      ? "drive.dialog.createFolderTitle"
      : action.type === "rename"
        ? "drive.dialog.renameTitle"
        : action.type === "move"
          ? "drive.dialog.moveTitle"
          : "drive.dialog.deleteTitle";

  return (
    <Dialog
      actions={
        <>
          <Button onClick={() => onOpenChange(false)} variant="ghost">
            {t("drive.dialog.cancel")}
          </Button>
          <Button form="drive-action-form" type="submit" variant={action.type === "delete" ? "danger" : "primary"}>
            {action.type === "delete" ? t("drive.dialog.deleteConfirm") : t("drive.dialog.save")}
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
        {action.type === "move" ? (
          <Input
            aria-label={t("drive.dialog.folderIdLabel")}
            autoFocus
            hint={t("drive.dialog.moveHint")}
            label={t("drive.dialog.folderIdLabel")}
            onChange={(event) => setValue(event.currentTarget.value)}
            value={value}
          />
        ) : null}
        {action.type === "delete" ? <p>{t("drive.dialog.deleteBody")}</p> : null}
        {error ? <p className="text-app-danger">{error}</p> : null}
      </form>
    </Dialog>
  );
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
