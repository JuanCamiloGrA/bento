import { useMemo, useState } from "react";
import type { ReactNode, UIEvent } from "react";

export type VirtualListProps<T> = {
  estimateSize: number;
  getKey: (item: T, index: number) => string;
  height?: number;
  items: T[];
  overscan?: number;
  renderItem: (item: T, index: number) => ReactNode;
};

export function VirtualList<T>({
  estimateSize,
  getKey,
  height = 360,
  items,
  overscan = 3,
  renderItem,
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const totalSize = items.length * estimateSize;
  const startIndex = Math.max(0, Math.floor(scrollTop / estimateSize) - overscan);
  const visibleCount = Math.ceil(height / estimateSize) + overscan * 2;
  const visibleItems = useMemo(
    () => items.slice(startIndex, startIndex + visibleCount),
    [items, startIndex, visibleCount],
  );

  function onScroll(event: UIEvent<HTMLDivElement>) {
    setScrollTop(event.currentTarget.scrollTop);
  }

  return (
    <div
      className="relative overflow-y-auto rounded-app-card border border-app-border bg-app-surface"
      onScroll={onScroll}
      role="list"
      style={{ height }}
    >
      <div className="relative" style={{ height: totalSize }}>
        {visibleItems.map((item, visibleIndex) => {
          const index = startIndex + visibleIndex;

          return (
            <div
              className="absolute left-0 top-0 w-full"
              key={getKey(item, index)}
              role="listitem"
              style={{ height: estimateSize, transform: `translateY(${index * estimateSize}px)` }}
            >
              {renderItem(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
