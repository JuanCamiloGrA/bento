# Styling And Design Architecture

Use Tailwind with CSS variables for tokens. Shared UI primitives live in `apps/web/src/components`; feature-specific compositions live in `apps/web/src/features`.

## Layout

- Persistent sidebar.
- Persistent top global search bar.
- Main content region with route-specific content.
- Status/job indicator always visible.
- Settings reachable from sidebar.

## Product Feel

This is a private local productivity app, not a marketing site. Use dense, calm, scan-friendly layouts. Avoid decorative hero sections and one-note color themes.

## UI Requirements

- Drive: breadcrumb, grid/list toggle, folder cards, file cards, drag/drop upload, context menu, rename, move, delete, download, preview.
- Photos: virtualized timeline, date grouping, grid, lightbox, video basic viewer, favorite toggle, album assignment.
- Search: grouped results, filters, match explanation, thumbnails, indexing state.
- Jobs: status, retry action, visible failures.

## Component Rules

- Shared primitives are generic and domain-neutral.
- Feature modules own domain-specific components.
- Use icon buttons with tooltips for common actions.
- Cards use border radius `8px` or less.
- Stable dimensions are required for grids, thumbnails, icon buttons, and toolbars to avoid layout shift.
- Text must not overflow buttons, cards, or sidebars at supported desktop/mobile widths.
