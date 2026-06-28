import type { ReactNode } from "react";

import { cx } from "../lib/cx";
import { t } from "../i18n/dictionary";

export type ThumbnailProps = {
  alt?: string;
  children?: ReactNode;
  className?: string;
  src?: string;
};

export function Thumbnail({ alt = t("common.thumbnail"), children, className, src }: ThumbnailProps) {
  return (
    <div
      className={cx(
        "aspect-square w-full max-w-64 overflow-hidden rounded-app-control border border-app-border bg-app-surface-muted",
        className,
      )}
    >
      {src ? (
        <img alt={alt} className="h-full w-full object-cover" loading="lazy" src={src} />
      ) : (
        <div className="grid h-full w-full place-items-center p-3 text-center text-xs text-app-text-muted">
          {children ?? alt}
        </div>
      )}
    </div>
  );
}
