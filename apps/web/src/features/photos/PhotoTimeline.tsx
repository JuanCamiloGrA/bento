import type { PhotoAsset, PhotoTimelineGroup } from "../../api/photos";
import { t } from "../../i18n/dictionary";
import { formatTimelineDate, groupTimelineByMonth } from "./dateGrouping";
import { PhotoGrid } from "./PhotoGrid";

export type PhotoTimelineProps = {
  groups: PhotoTimelineGroup[];
  onOpen: (asset: PhotoAsset) => void;
};

type DayRow = PhotoTimelineGroup & {
  monthLabel: string | null;
};

export function PhotoTimeline({ groups, onOpen }: PhotoTimelineProps) {
  const rows = flattenMonthRows(groups);

  return (
    <section aria-label={t("photos.timelineLabel")} className="grid gap-6">
      {rows.map((group) => (
        <section className="grid gap-3.5" key={group.date}>
          {group.monthLabel ? (
            <h2 className="mt-2 text-xl font-bold tracking-tight text-app-text/90">{group.monthLabel}</h2>
          ) : null}
          <div className="grid gap-2.5">
            <div className="px-1">
              <h3 className="text-sm font-bold text-app-text/90">{formatTimelineDate(group.date)}</h3>
            </div>
            <PhotoGrid assets={group.assets} onOpen={onOpen} />
          </div>
        </section>
      ))}
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
