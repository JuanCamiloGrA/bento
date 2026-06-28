import type { ReactNode } from "react";

import { cx } from "../lib/cx";

export type TabItem<T extends string> = {
  content: ReactNode;
  label: string;
  value: T;
};

export type TabsProps<T extends string> = {
  ariaLabel: string;
  onChange: (value: T) => void;
  tabs: Array<TabItem<T>>;
  value: T;
};

export function Tabs<T extends string>({ ariaLabel, onChange, tabs, value }: TabsProps<T>) {
  const selectedTab = tabs.find((tab) => tab.value === value) ?? tabs[0];

  return (
    <div className="grid gap-3">
      <div aria-label={ariaLabel} className="flex gap-1 border-b border-app-border" role="tablist">
        {tabs.map((tab) => {
          const selected = tab.value === selectedTab.value;

          return (
            <button
              aria-selected={selected}
              className={cx(
                "h-9 rounded-t-app-control border-b-2 px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-app-accent",
                selected
                  ? "border-app-accent text-app-text"
                  : "border-transparent text-app-text-muted hover:text-app-text",
              )}
              key={tab.value}
              onClick={() => onChange(tab.value)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="min-w-0" role="tabpanel">
        {selectedTab.content}
      </div>
    </div>
  );
}
