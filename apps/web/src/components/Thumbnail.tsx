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
        "aspect-square w-full max-w-64 overflow-hidden rounded-app-control border border-app-border bg-slate-100/70 shadow-3xs flex items-center justify-center transition-all duration-300",
        className,
      )}
    >
      {src ? (
        <img alt={alt} className="h-full w-full object-cover select-none" loading="lazy" src={src} />
      ) : (
        <div className="grid h-full w-full place-items-center p-3 text-center text-xs font-medium text-app-text-muted/80 bg-slate-100/40 select-none">
          {children ?? alt}
        </div>
      )}
    </div>
  );
}
