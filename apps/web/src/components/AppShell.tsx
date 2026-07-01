import type { ReactNode } from "react";

import { t } from "../i18n/dictionary";
import { Sidebar } from "./Sidebar";
import type { SidebarItem } from "./Sidebar";
import { StatusIndicator } from "./StatusIndicator";
import { TopSearch } from "./TopSearch";

export type AppShellProps = {
  activePath: string;
  children: ReactNode;
  navItems: SidebarItem[];
  onNavigate: (href: string) => void;
  onSearch: (query: string) => void;
  status?: ReactNode;
};

export function AppShell({ activePath, children, navItems, onNavigate, onSearch, status }: AppShellProps) {
  return (
    <div className="min-h-screen bg-app-bg text-app-text">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-app-control focus:bg-app-surface focus:px-3 focus:py-2 focus:text-app-text focus:outline focus:outline-2 focus:outline-app-accent"
        href="#main-content"
      >
        {t("shell.skipToContent")}
      </a>
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[16rem_minmax(0,1fr)]">
        <Sidebar activePath={activePath} items={navItems} onNavigate={onNavigate} />
        <section className="flex min-w-0 flex-col">
          <header
            aria-label={t("shell.topbarLabel")}
            className="flex min-h-14 items-center border-b border-app-border bg-app-surface px-6"
          >
            <TopSearch onSubmit={onSearch} />
          </header>
          <main
            aria-label={t("shell.mainLabel")}
            className="min-h-0 flex-1 overflow-auto p-5 md:p-6"
            id="main-content"
          >
            {children}
          </main>
          {status ?? <StatusIndicator />}
        </section>
      </div>
    </div>
  );
}
