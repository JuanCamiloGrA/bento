import { t } from "../i18n/dictionary";
import { cx } from "../lib/cx";

export type SidebarItem = {
  href: string;
  label: string;
};

export type SidebarProps = {
  activePath: string;
  items: SidebarItem[];
  onNavigate: (href: string) => void;
};

export function Sidebar({ activePath, items, onNavigate }: SidebarProps) {
  return (
    <aside className="border-b border-app-border bg-app-surface-muted px-3 py-3 md:border-b-0 md:border-r">
      <a
        className="inline-flex h-9 items-center rounded-app-control px-2 text-lg font-semibold text-app-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent"
        href="/photos"
        onClick={(event) => {
          event.preventDefault();
          onNavigate("/photos");
        }}
      >
        {t("app.brand")}
      </a>
      <nav aria-label={t("nav.label")} className="mt-3 flex gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-visible">
        {items.map((item) => {
          const active = activePath === item.href || activePath.startsWith(`${item.href}/`);

          return (
            <a
              aria-current={active ? "page" : undefined}
              className={cx(
                "inline-flex h-9 max-w-44 shrink-0 items-center rounded-app-control px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent md:max-w-full",
                active
                  ? "bg-app-accent-muted text-app-text"
                  : "text-app-text-muted hover:bg-app-surface hover:text-app-text",
              )}
              href={item.href}
              key={item.href}
              onClick={(event) => {
                event.preventDefault();
                onNavigate(item.href);
              }}
            >
              <span className="truncate">{item.label}</span>
            </a>
          );
        })}
      </nav>
    </aside>
  );
}
