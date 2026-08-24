import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, UIEvent } from "react";

import { cx } from "../lib/cx";

export type VirtualGridProps<T> = {
  className?: string;
  gap?: number;
  getKey: (item: T, index: number) => string;
  height?: number;
  items: T[];
  minColumnWidth?: number;
  overscan?: number;
  renderItem: (item: T, index: number) => ReactNode;
  rowHeight: number;
};

export function VirtualGrid<T>({
  className,
  gap = 12,
  getKey,
  height = 420,
  items,
  minColumnWidth = 160,
  overscan = 2,
  renderItem,
  rowHeight,
}: VirtualGridProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [width, setWidth] = useState(minColumnWidth * 2 + gap);
  const columns = Math.max(1, Math.floor((width + gap) / (minColumnWidth + gap)));
  const rowCount = Math.ceil(items.length / columns);
  const rowStride = rowHeight + gap;
  const totalSize = Math.max(0, rowCount * rowStride - gap);
  const startRow = Math.max(0, Math.floor(scrollTop / rowStride) - overscan);
  const visibleRows = Math.ceil(height / rowStride) + overscan * 2;
  const startIndex = startRow * columns;
  const visibleCount = visibleRows * columns;
  const visibleItems = useMemo(
    () => items.slice(startIndex, startIndex + visibleCount),
    [items, startIndex, visibleCount],
  );

  useEffect(() => {
    const element = containerRef.current;

    if (!element || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  function onScroll(event: UIEvent<HTMLDivElement>) {
    setScrollTop(event.currentTarget.scrollTop);
  }

  const columnWidth = (width - gap * (columns - 1)) / columns;

  return (
    <div
      className={cx("relative overflow-y-auto rounded-app-card border border-app-border bg-app-surface", className)}
      onScroll={onScroll}
      ref={containerRef}
      role="grid"
      style={{ height }}
    >
      <div className="relative min-w-full" style={{ height: totalSize }}>
        {visibleItems.map((item, visibleIndex) => {
          const index = startIndex + visibleIndex;
          const row = Math.floor(index / columns);
          const column = index % columns;

          return (
            <div
              className="absolute"
              key={getKey(item, index)}
              role="gridcell"
              style={{
                height: rowHeight,
                transform: `translate(${column * (columnWidth + gap)}px, ${row * rowStride}px)`,
                width: columnWidth,
              }}
            >
              {renderItem(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
