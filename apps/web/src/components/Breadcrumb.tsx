import { cx } from "../lib/cx";

export type BreadcrumbItem = {
  current?: boolean;
  href?: string;
  label: string;
  onNavigate?: (href: string) => void;
};

export type BreadcrumbProps = {
  items: BreadcrumbItem[];
  label: string;
};

export function Breadcrumb({ items, label }: BreadcrumbProps) {
  return (
    <nav aria-label={label}>
      <ol className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm text-app-text-muted">
        {items.map((item, index) => (
          <li className="flex min-w-0 items-center gap-1.5" key={`${item.label}-${index}`}>
            {index > 0 ? (
              <span aria-hidden="true" className="text-app-text-muted/40 px-0.5 select-none">
                <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </span>
            ) : null}
            {item.href && !item.current ? (
              <a
                className="truncate rounded-app-control px-1.5 py-0.5 text-app-text hover:bg-app-surface-muted hover:text-app-accent transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-app-accent"
                href={item.href}
                onClick={(event) => {
                  const href = item.href;

                  if (!item.onNavigate || !href) {
                    return;
                  }

                  event.preventDefault();
                  item.onNavigate(href);
                }}
              >
                {item.label}
              </a>
            ) : (
              <span
                aria-current={item.current ? "page" : undefined}
                className={cx("truncate px-1.5 py-0.5", item.current ? "font-bold text-app-text" : undefined)}
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
