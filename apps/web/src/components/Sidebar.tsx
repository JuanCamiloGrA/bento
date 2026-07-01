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
    <aside className="border-b border-app-border bg-app-surface px-5 py-5 md:border-b-0 md:border-r md:py-6">
      <a
        className="inline-flex h-11 items-center gap-3 rounded-app-control px-2 text-lg font-bold tracking-tight text-app-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent"
        href="/photos"
        onClick={(event) => {
          event.preventDefault();
          onNavigate("/photos");
        }}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-app-accent text-sm font-black text-white shadow-sm shadow-app-accent/20">
          B
        </span>
        <span>{t("app.brand")}</span>
      </a>
      <nav aria-label={t("nav.label")} className="mt-6 flex gap-1.5 overflow-x-auto pb-1 md:flex-col md:gap-1 md:overflow-visible">
        {items.map((item) => {
          const active = activePath === item.href || activePath.startsWith(`${item.href}/`);

          return (
            <a
              aria-current={active ? "page" : undefined}
              className={cx(
                "inline-flex h-11 max-w-52 shrink-0 items-center gap-3 rounded-app-control px-3.5 text-sm font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent md:max-w-full",
                active
                  ? "bg-app-accent text-white shadow-sm shadow-app-accent/20 font-semibold"
                  : "text-app-text-muted hover:bg-app-surface-muted hover:text-app-text",
              )}
              href={item.href}
              key={item.href}
              onClick={(event) => {
                event.preventDefault();
                onNavigate(item.href);
              }}
            >
              {getSidebarIcon(item.href)}
              <span className="truncate">{item.label}</span>
            </a>
          );
        })}
      </nav>
    </aside>
  );
}

function getSidebarIcon(href: string) {
  if (href.startsWith("/photos")) {
    return (
      <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
        <circle cx="9" cy="9" r="2"/>
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
      </svg>
    );
  }
  if (href.startsWith("/albums")) {
    return (
      <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
        <path d="M6 6h10M6 10h10"/>
      </svg>
    );
  }
  if (href.startsWith("/favorites")) {
    return (
      <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    );
  }
  if (href.startsWith("/drive")) {
    return (
      <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
    );
  }
  if (href.startsWith("/documents")) {
    return (
      <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
        <path d="M14 2v4a2 2 0 0 0 2 2h4M10 9h4M10 13h6M10 17h6"/>
      </svg>
    );
  }
  if (href.startsWith("/jobs")) {
    return (
      <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    );
  }
  if (href.startsWith("/settings")) {
    return (
      <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  );
}
