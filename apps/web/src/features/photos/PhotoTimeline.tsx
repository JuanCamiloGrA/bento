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
        estimateSize={372}
        getKey={(group) => group.date}
        height={650}
        items={rows}
        renderItem={(group) => (
          <section className="grid gap-3 pr-2">
            {group.monthLabel ? (
              <h2 className="text-lg font-semibold capitalize text-app-text">{group.monthLabel}</h2>
            ) : null}
            <div className="grid gap-2">
              <div className="flex items-end justify-between gap-3">
                <h3 className="text-sm font-semibold capitalize text-app-text">{formatTimelineDate(group.date)}</h3>
                <span className="text-xs text-app-text-muted">
                  {group.assets.length} {group.assets.length === 1 ? t("photos.item") : t("photos.items")}
                </span>
              </div>
              <PhotoGrid
                assets={group.assets}
                height={272}
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
