import { VirtualList } from "../../components/VirtualList";
import type { PhotoAsset, PhotoTimelineGroup } from "../../api/photos";
import { t } from "../../i18n/dictionary";
import { formatTimelineDate, groupTimelineByMonth } from "./dateGrouping";
import { PhotoGrid } from "./PhotoGrid";

export type PhotoTimelineProps = {
  groups: PhotoTimelineGroup[];
  onOpen: (asset: PhotoAsset) => void;
  onToggleFavorite: (asset: PhotoAsset) => void;
};

type DayRow = PhotoTimelineGroup & {
  monthLabel: string | null;
};

export function PhotoTimeline({ groups, onOpen, onToggleFavorite }: PhotoTimelineProps) {
  const rows = flattenMonthRows(groups);

  return (
    <section aria-label={t("photos.timelineLabel")} className="grid gap-3">
      <VirtualList
        estimateSize={480}
        getKey={(group) => group.date}
        height={860}
        items={rows}
        renderItem={(group) => (
          <section className="grid gap-3.5 pr-2 pb-4">
            {group.monthLabel ? (
              <h2 className="text-xl font-bold tracking-tight text-app-text/90 border-b border-app-border/80 pb-2 mt-5 mb-2">{group.monthLabel}</h2>
            ) : null}
            <div className="grid gap-2.5">
              <div className="flex items-end justify-between gap-3 px-1">
                <h3 className="text-sm font-bold text-app-text/90">{formatTimelineDate(group.date)}</h3>
                <span className="text-xs text-app-text-muted font-medium bg-slate-100 px-2 py-0.5 rounded-full select-none">
                  {group.assets.length} {group.assets.length === 1 ? t("photos.item") : t("photos.items")}
                </span>
              </div>
              <PhotoGrid
                assets={group.assets}
                height={380}
                onOpen={onOpen}
                onToggleFavorite={onToggleFavorite}
              />
            </div>
          </section>
        )}
      />
    </section>
  );
}

function flattenMonthRows(groups: PhotoTimelineGroup[]): DayRow[] {
  return groupTimelineByMonth(groups).flatMap((month) =>
    month.days.map((day, index) => ({
      ...day,
      monthLabel: index === 0 ? month.monthLabel : null,
    })),
  );
}
