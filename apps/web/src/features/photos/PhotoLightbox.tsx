import { useEffect, useId, useRef } from "react";

import { IconButton } from "../../components/IconButton";
import { assetDownloadUrl, assetPreviewUrl } from "../../api/photos";
import type { PhotoAsset } from "../../api/photos";
import { t } from "../../i18n/dictionary";
import { ProcessingStateBadge } from "./ProcessingStateBadge";

const focusableSelector = [
  "a[href]",
  "button:not(:disabled)",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export type PhotoLightboxProps = {
  asset: PhotoAsset | null;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onToggleFavorite: (asset: PhotoAsset) => void;
};

export function PhotoLightbox({ asset, onClose, onNext, onPrevious, onToggleFavorite }: PhotoLightboxProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!asset) {
      return;
    }

    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const focusable = getFocusable(panelRef.current);
    (focusable[0] ?? panelRef.current)?.focus();

    function onDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }

      if (event.key === "ArrowRight") {
        onNext?.();
      }

      if (event.key === "ArrowLeft") {
        onPrevious?.();
      }

      if (event.key === "Tab") {
        trapFocus(event, panelRef.current);
      }
    }

    document.addEventListener("keydown", onDocumentKeyDown);

    return () => {
      document.removeEventListener("keydown", onDocumentKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [asset, onClose, onNext, onPrevious]);

  if (!asset) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 grid bg-slate-950/80 backdrop-blur-md p-4 text-white transition-all duration-300" role="presentation">
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="grid h-full min-h-0 grid-rows-[auto_1fr] rounded-2xl border border-white/10 bg-slate-900/90 shadow-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-app-accent overflow-hidden"
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex min-w-0 items-center justify-between gap-4 border-b border-white/5 bg-slate-950/20 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold tracking-tight" id={titleId}>
              {asset.filename}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-xs text-white/70">{asset.kind === "video" ? t("photos.video") : t("photos.photo")}</span>
              <ProcessingStateBadge state={asset.processing_state} />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <IconButton
              className="border-white/25 bg-black/30 text-white hover:bg-white/10"
              icon={asset.favorite ? "*" : "+"}
              label={asset.favorite ? t("photos.unfavorite") : t("photos.favorite")}
              onClick={() => onToggleFavorite(asset)}
            />
            <IconButton
              className="border-white/25 bg-black/30 text-white hover:bg-white/10"
              disabled={!onPrevious}
              icon="<"
              label={t("photos.previous")}
              onClick={onPrevious}
            />
            <IconButton
              className="border-white/25 bg-black/30 text-white hover:bg-white/10"
              disabled={!onNext}
              icon=">"
              label={t("photos.next")}
              onClick={onNext}
            />
            <IconButton
              className="border-white/25 bg-black/30 text-white hover:bg-white/10"
              icon="x"
              label={t("common.close")}
              onClick={onClose}
            />
          </div>
        </div>
        <div className="grid min-h-0 place-items-center p-6 bg-slate-950/20">
          {asset.kind === "video" ? (
            <video
              aria-label={asset.filename}
              className="max-h-full max-w-full rounded-lg shadow-lg border border-white/5"
              controls
              src={assetDownloadUrl(asset)}
            />
          ) : (
            <img alt={asset.filename} className="max-h-full max-w-full object-contain rounded-lg shadow-lg border border-white/5" src={assetPreviewUrl(asset)} />
          )}
        </div>
      </div>
    </div>
  );
}

function getFocusable(root: HTMLElement | null): HTMLElement[] {
  if (!root) {
    return [];
  }

  return Array.from(root.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => !element.hasAttribute("disabled") && element.tabIndex !== -1,
  );
}

function trapFocus(event: globalThis.KeyboardEvent, root: HTMLElement | null) {
  const focusable = getFocusable(root);

  if (focusable.length === 0) {
    event.preventDefault();
    root?.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
