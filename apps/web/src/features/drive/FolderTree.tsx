import { useEffect, useState } from "react";

import type { DriveApi, DriveBreadcrumb, DriveFolder } from "../../api/drive";
import { cx } from "../../lib/cx";
import { t } from "../../i18n/dictionary";

type FolderTreeProps = {
  api: DriveApi;
  breadcrumbs: DriveBreadcrumb[];
  currentFolderId: string | null;
  onNavigate: (folderId: string | null) => void;
  reloadKey: number;
};

export function FolderTree({ api, breadcrumbs, currentFolderId, onNavigate, reloadKey }: FolderTreeProps) {
  const [children, setChildren] = useState<Record<string, DriveFolder[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([rootKey]));
  const [loading, setLoading] = useState<Set<string>>(() => new Set());
  const [failed, setFailed] = useState<Set<string>>(() => new Set());

  async function loadChildren(folderId: string | null) {
    const key = folderKey(folderId);
    setLoading((current) => new Set(current).add(key));
    setFailed((current) => without(current, key));
    try {
      const folders: DriveFolder[] = [];
      let cursor: string | null = null;
      do {
        const page = await api.listItems({ cursor, folderId, limit: 100 });
        folders.push(...page.items.filter((item) => item.type === "folder").map((item) => item.folder));
        cursor = page.next_cursor;
      } while (cursor);
      folders.sort((left, right) => left.name.localeCompare(right.name, "es", { sensitivity: "base" }));
      setChildren((current) => ({ ...current, [key]: folders }));
    } catch {
      setFailed((current) => new Set(current).add(key));
    } finally {
      setLoading((current) => without(current, key));
    }
  }

  useEffect(() => {
    const ancestorIds = breadcrumbs.map((item) => item.folder_id).filter((id): id is string => id !== null);
    const openKeys = new Set([rootKey, ...ancestorIds.map(folderKey)]);
    setExpanded(openKeys);
    setChildren({});
    setFailed(new Set());
    void Promise.all([loadChildren(null), ...ancestorIds.map((id) => loadChildren(id))]);
    // loadChildren intentionally reads the current API implementation for this refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, breadcrumbs, reloadKey]);

  function toggle(folderId: string | null) {
    const key = folderKey(folderId);
    const isOpen = expanded.has(key);
    setExpanded((current) => {
      const next = new Set(current);
      if (isOpen) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    if (!isOpen && !children[key] && !loading.has(key)) {
      void loadChildren(folderId);
    }
  }

  return (
    <aside
      aria-label={t("drive.tree.label")}
      className="min-h-0 rounded-app-card border border-app-border bg-app-surface shadow-2xs"
    >
      <div className="flex items-center justify-between border-b border-app-border px-3.5 py-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-app-text-muted">{t("drive.tree.title")}</h2>
        <span className="rounded-full bg-app-accent-muted px-2 py-0.5 text-[11px] font-semibold text-teal-800">
          {t("drive.tree.cloud")}
        </span>
      </div>
      <div className="max-h-[640px] overflow-auto p-2" role="tree">
        <FolderNode
          ancestorIds={new Set()}
          childrenByParent={children}
          currentFolderId={currentFolderId}
          depth={0}
          expanded={expanded}
          failed={failed}
          folder={null}
          label={t("drive.root")}
          loading={loading}
          onLoad={loadChildren}
          onNavigate={onNavigate}
          onToggle={toggle}
        />
      </div>
    </aside>
  );
}

type FolderNodeProps = {
  ancestorIds: Set<string>;
  childrenByParent: Record<string, DriveFolder[]>;
  currentFolderId: string | null;
  depth: number;
  expanded: Set<string>;
  failed: Set<string>;
  folder: DriveFolder | null;
  label: string;
  loading: Set<string>;
  onLoad: (folderId: string | null) => Promise<void>;
  onNavigate: (folderId: string | null) => void;
  onToggle: (folderId: string | null) => void;
};

function FolderNode(props: FolderNodeProps) {
  const { ancestorIds, childrenByParent, currentFolderId, depth, expanded, failed, folder, label, loading, onLoad, onNavigate, onToggle } = props;
  const folderId = folder?.id ?? null;
  const key = folderKey(folderId);
  const isExpanded = expanded.has(key);
  const isCurrent = folderId === currentFolderId;
  const childFolders = childrenByParent[key];
  const isLoading = loading.has(key);
  const hasKnownChildren = Boolean(childFolders?.length);

  return (
    <div aria-expanded={isExpanded} aria-selected={isCurrent} role="treeitem">
      <div
        className={cx(
          "group flex min-w-0 items-center gap-1 rounded-app-control py-1 pr-1 transition-colors duration-150",
          isCurrent ? "bg-app-accent-muted text-teal-900" : "text-app-text hover:bg-app-surface-muted",
        )}
        style={{ paddingLeft: `${Math.min(depth, 8) * 14 + 4}px` }}
      >
        <button
          aria-label={`${isExpanded ? t("drive.tree.collapse") : t("drive.tree.expand")} ${label}`}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-app-text-muted hover:bg-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-app-accent"
          onClick={() => onToggle(folderId)}
          type="button"
        >
          <svg
            aria-hidden="true"
            className={cx("h-3.5 w-3.5 transition-transform duration-150", isExpanded ? "rotate-90" : undefined)}
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
        <button
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-app-accent"
          onClick={() => onNavigate(folderId)}
          type="button"
        >
          <FolderIcon open={isExpanded} />
          <span className="truncate">{label}</span>
          {isLoading ? <span className="ml-auto h-3 w-3 animate-spin rounded-full border border-app-border border-t-app-accent" /> : null}
        </button>
      </div>
      {isExpanded ? (
        <div role="group">
          {failed.has(key) ? (
            <button
              className="ml-9 rounded px-2 py-1 text-xs font-semibold text-app-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-app-danger"
              onClick={() => void onLoad(folderId)}
              type="button"
            >
              {t("drive.tree.retry")}
            </button>
          ) : null}
          {!isLoading && childFolders && !hasKnownChildren ? (
            <p className="py-1 pr-2 text-xs text-app-text-muted" style={{ paddingLeft: `${(depth + 2) * 14}px` }}>
              {t("drive.tree.empty")}
            </p>
          ) : null}
          {childFolders?.filter((child) => child.id !== folderId && !ancestorIds.has(child.id)).map((child) => (
            <FolderNode
              {...props}
              ancestorIds={new Set([...ancestorIds, ...(folderId ? [folderId] : [])])}
              depth={depth + 1}
              folder={child}
              key={child.id}
              label={child.name}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
      <path d={open ? "M3 7.5h7l2 2h9l-2.2 9H5.2L3 7.5Z" : "M3 5h7l2 2h9v11.5H3V5Z"} />
    </svg>
  );
}

const rootKey = "__root__";

function folderKey(folderId: string | null): string {
  return folderId ?? rootKey;
}

function without(values: Set<string>, value: string): Set<string> {
  const next = new Set(values);
  next.delete(value);
  return next;
}
