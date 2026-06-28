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
      <ol className="flex min-w-0 flex-wrap items-center gap-1 text-sm text-app-text-muted">
        {items.map((item, index) => (
          <li className="flex min-w-0 items-center gap-1" key={`${item.label}-${index}`}>
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {item.href && !item.current ? (
              <a
                className="truncate rounded-app-control px-1 text-app-text hover:bg-app-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-app-accent"
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
                className={cx("truncate px-1", item.current ? "font-medium text-app-text" : undefined)}
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
