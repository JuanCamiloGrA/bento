import { t } from "../../i18n/dictionary";
import type { MessageKey } from "../../i18n/dictionary";
import type { PhotoProcessingState } from "../../api/photos";
import { cx } from "../../lib/cx";

const stateLabels: Record<PhotoProcessingState, MessageKey> = {
  blob_stored: "photos.state.blobStored",
  created: "photos.state.created",
  embedding_pending: "photos.state.embeddingPending",
  embedding_ready: "photos.state.embeddingReady",
  failed: "photos.state.failed",
  failed_partial: "photos.state.partialFailure",
  indexed: "photos.state.indexed",
  metadata_extracted: "photos.state.metadataExtracted",
  ocr_pending: "photos.state.ocrPending",
  ocr_ready: "photos.state.ocrReady",
  thumbnail_pending: "photos.state.thumbnailPending",
  thumbnail_ready: "photos.state.thumbnailReady",
};

const stateClasses: Record<PhotoProcessingState, string> = {
  blob_stored: "border-slate-200 bg-slate-50 text-slate-600",
  created: "border-slate-200 bg-slate-50 text-slate-600",
  embedding_pending: "border-amber-200 bg-amber-50/70 text-amber-700",
  embedding_ready: "border-emerald-200 bg-emerald-50 text-emerald-700",
  failed: "border-red-200 bg-red-50 text-red-700 font-semibold",
  failed_partial: "border-red-200 bg-red-50/50 text-red-700",
  indexed: "border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold",
  metadata_extracted: "border-slate-200 bg-slate-50 text-slate-600",
  ocr_pending: "border-amber-200 bg-amber-50/70 text-amber-700",
  ocr_ready: "border-emerald-200 bg-emerald-50 text-emerald-700",
  thumbnail_pending: "border-amber-200 bg-amber-50/70 text-amber-700",
  thumbnail_ready: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export type ProcessingStateBadgeProps = {
  state: PhotoProcessingState | null;
};

export function ProcessingStateBadge({ state }: ProcessingStateBadgeProps) {
  if (!state) {
    return null;
  }

  return (
    <span
      className={cx(
        "inline-flex h-5.5 max-w-full items-center rounded-app-control border px-2 text-[10px] uppercase font-bold tracking-wider select-none transition-all duration-200",
        stateClasses[state],
      )}
    >
      <span className="truncate">{t(stateLabels[state])}</span>
    </span>
  );
}
