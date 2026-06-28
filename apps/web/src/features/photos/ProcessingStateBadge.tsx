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

const stateClasses: Partial<Record<PhotoProcessingState, string>> = {
  failed: "border-app-danger text-app-danger",
  failed_partial: "border-app-warning text-app-warning",
  indexed: "border-app-success text-app-success",
  thumbnail_pending: "border-app-warning text-app-warning",
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
        "inline-flex h-6 max-w-full items-center rounded-app-control border border-app-border bg-app-surface px-2 text-xs text-app-text-muted",
        stateClasses[state],
      )}
    >
      <span className="truncate">{t(stateLabels[state])}</span>
    </span>
  );
}
