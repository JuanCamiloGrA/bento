# UI Primitives

Shared primitives belong in `apps/web/src/components`. Feature-specific variants belong in feature folders.

Required primitives:

- `AppShell`
- `Sidebar`
- `TopSearch`
- `StatusIndicator`
- `Button`
- `IconButton`
- `Tooltip`
- `Input`
- `Select`
- `Checkbox`
- `SegmentedControl`
- `Menu`
- `Dialog`
- `Breadcrumb`
- `Tabs`
- `EmptyState`
- `LoadingState`
- `ErrorState`
- `Thumbnail`
- `VirtualGrid`
- `VirtualList`

Rules:

- Use icons for common actions: upload, download, rename, move, delete, favorite, retry, settings, search, grid/list.
- Icon-only controls need `aria-label`.
- Do not nest cards inside cards.
- Keep repeated item cards stable in size.
- Shared primitives do not know about assets, folders, albums, jobs, or Telegram.
- Domain behavior is composed in feature modules.
