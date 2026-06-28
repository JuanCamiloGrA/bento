# Routing And Entrypoints

## Backend Entrypoints

- API: `python -m bento.interfaces.http.main` or equivalent Uvicorn target.
- Worker: `python -m bento.interfaces.worker.main`.
- Telegram webhook handler is mounted in FastAPI under `/api/telegram/webhook`.

## HTTP Route Groups

- Health/settings: `/api/health`, `/api/version`, `/api/settings`
- Assets/upload: `/api/assets/*`
- Drive: `/api/drive/*`
- Photos: `/api/photos/*`
- Search: `/api/search`
- Jobs/admin: `/api/jobs`, `/api/admin/reindex`
- Telegram: `/api/telegram/webhook`

Keep routers thin: parse requests, call use cases, map errors.

## Frontend Routes

Assumption: Vite SPA with client-side routing.

- `/`: redirect to `/photos` or last active mode.
- `/search`: global search results.
- `/photos`: timeline.
- `/photos/:assetId`: lightbox/deep link.
- `/albums`: album list.
- `/albums/:albumId`: album detail.
- `/favorites`: favorite photos/assets.
- `/drive`: root folder.
- `/drive/folders/:folderId`: folder browser.
- `/documents`: document filtered search/list.
- `/jobs`: job status.
- `/settings`: settings and storage status.

The sidebar and top global search bar remain visible on all main routes.

## UI Command Entrypoints

- `Cmd/Ctrl+K`: focus global search.
- Drag-and-drop upload in Drive and Photos.
- Context menu for Drive file/folder actions.
- Lightbox actions for photo/video favorite and album assignment.
