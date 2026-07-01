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
import { Thumbnail } from "../../components/Thumbnail";
import { VirtualGrid } from "../../components/VirtualGrid";
import { VirtualList } from "../../components/VirtualList";
import { cx } from "../../lib/cx";
import { t } from "../../i18n/dictionary";
import { entryFromItem, entryFromSearchItem, formatBytes, isIndexingState, isPartialFailureState } from "./driveModel";
import type { DriveEntry } from "./driveModel";
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
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [dialogValue, setDialogValue] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  async function uploadFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }

    setUploading(true);
    setActionError(null);
    try {
      await api.uploadFiles({ files, folderId });
      await reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t("drive.error.action"));
    } finally {
      setUploading(false);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    void uploadFiles(Array.from(event.dataTransfer.files));
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
      className="grid gap-4"
      onDragEnter={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
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
          <Button onClick={() => fileInputRef.current?.click()} variant="primary" className="cursor-pointer font-semibold shadow-sm">
            {uploading ? t("drive.upload.uploading") : t("drive.upload.pick")}
          </Button>
          <input
            aria-label={t("drive.upload.pick")}
            className="sr-only"
            multiple
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = "";
              void uploadFiles(files);
            }}
            ref={fileInputRef}
            type="file"
          />
        </div>
      </div>

      <div
        className={cx(
          "rounded-app-card border border-app-border bg-app-surface p-5 transition-all duration-300 shadow-2xs",
          dragActive ? "border-app-accent bg-app-accent-muted/40 ring-4 ring-app-accent/10" : undefined,
        )}
        onDragLeave={() => setDragActive(false)}
      >
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
          <Button onClick={() => setSubmittedQuery(query)} className="cursor-pointer font-semibold shadow-2xs">{t("drive.search.submit")}</Button>
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
        <p className="mt-3 text-sm text-app-text-muted/95 leading-relaxed">{t("drive.upload.dropHint")}</p>
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
          action={<Button onClick={() => fileInputRef.current?.click()} variant="primary" className="shadow-sm font-semibold">{t("drive.upload.pick")}</Button>}
          body={showingSearch ? t("drive.empty.searchBody") : t("drive.empty.body")}
          title={showingSearch ? t("drive.empty.searchTitle") : t("drive.empty.title")}
        />
      ) : null}

      {visibleEntries.length > 0 && layout === "grid" ? (
        <VirtualGrid
          getKey={(entry) => `${entry.kind}-${entry.id}`}
          height={540}
          items={visibleEntries}
          minColumnWidth={192}
          renderItem={(entry) => (
            <DriveGridCard
              api={api}
              entry={entry}
              onNavigate={navigate}
              onOpenAction={openAction}
              searchMode={showingSearch}
            />
          )}
          rowHeight={268}
        />
      ) : null}

      {visibleEntries.length > 0 && layout === "list" ? (
        <VirtualList
          estimateSize={84}
          getKey={(entry) => `${entry.kind}-${entry.id}`}
          height={540}
          items={visibleEntries}
          renderItem={(entry) => (
            <DriveListRow
              api={api}
              entry={entry}
              onNavigate={navigate}
              onOpenAction={openAction}
              searchMode={showingSearch}
            />
          )}
        />
      ) : null}

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

type EntryCardProps = {
  api: DriveApi;
  entry: DriveEntry;
  onNavigate: (folderId: string | null) => void;
  onOpenAction: (action: PendingAction) => void;
  searchMode: boolean;
};

function DriveGridCard({ api, entry, onNavigate, onOpenAction, searchMode }: EntryCardProps) {
  return (
    <article className="grid h-full grid-rows-[auto_1fr_auto] gap-2.5 rounded-app-card border border-app-border bg-app-surface p-3.5 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all duration-300 group">
      <button
        className="min-w-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent overflow-hidden rounded-app-control cursor-pointer"
        onClick={() => {
          if (entry.kind === "folder") {
            onNavigate(entry.id);
          }
        }}
        type="button"
      >
        <Thumbnail alt={entry.name} className="max-w-none rounded-none border-0 transition-transform duration-500 group-hover:scale-[1.03]" src={entry.thumbnailUrl ?? undefined}>
          {entry.kind === "folder" ? t("drive.item.folder") : t("drive.item.file")}
        </Thumbnail>
      </button>
      <div className="min-w-0">
        <h2 className="truncate text-sm font-bold tracking-tight text-app-text group-hover:text-app-accent transition-colors">{entry.name}</h2>
        <EntryMeta entry={entry} searchMode={searchMode} />
      </div>
      <EntryActions api={api} entry={entry} onOpenAction={onOpenAction} />
    </article>
  );
}

function DriveListRow({ api, entry, onNavigate, onOpenAction, searchMode }: EntryCardProps) {
  return (
    <article className="grid h-full grid-cols-[48px_1fr_auto] items-center gap-3.5 border-b border-app-border bg-app-surface px-4 py-2 hover:bg-slate-50 transition-all duration-150">
      <button
        className="rounded-app-control focus-visible:outline focus-visible:outline-2 focus-visible:outline-app-accent cursor-pointer"
        onClick={() => {
          if (entry.kind === "folder") {
            onNavigate(entry.id);
          }
        }}
        type="button"
      >
        <Thumbnail alt={entry.name} className="h-10 w-10 border border-app-border bg-slate-100 shadow-3xs" src={entry.thumbnailUrl ?? undefined}>
          {entry.kind === "folder" ? t("drive.item.folderShort") : t("drive.item.fileShort")}
        </Thumbnail>
      </button>
      <div className="min-w-0">
        <h2 className="truncate text-sm font-bold tracking-tight text-app-text">{entry.name}</h2>
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
    <div className="mt-1 grid gap-0.5 text-xs text-app-text-muted">
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
    <div className="flex items-center justify-between gap-3 border-t border-app-border/40 pt-2.5 mt-1.5 group-hover:border-slate-350 transition-colors">
      {entry.kind === "asset" ? (
        <div className="flex min-w-0 items-center gap-2">
          <a
            className="truncate rounded-app-control border border-app-border bg-app-surface px-2 py-1 text-xs font-semibold text-app-accent hover:bg-slate-50 active:bg-slate-100 transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-app-accent shadow-3xs"
            href={api.previewUrl(entry.id)}
            target="_blank"
          >
            {t("drive.action.preview")}
          </a>
          <a
            className="truncate rounded-app-control border border-app-border bg-app-surface px-2 py-1 text-xs font-semibold text-app-accent hover:bg-slate-50 active:bg-slate-100 transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-app-accent shadow-3xs"
            download
            href={api.downloadUrl(entry.id)}
          >
            {t("drive.action.download")}
          </a>
        </div>
      ) : (
        <span className="text-xs font-medium text-app-text-muted/80">{t("drive.item.folder")}</span>
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
