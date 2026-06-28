# API Endpoint Map

All routes are under `/api`.

## Health And Settings

- `GET /api/health`: returns service health and DB reachability.
- `GET /api/version`: returns app version/build info.
- `GET /api/settings`: returns storage/OCR/embedding/job configuration status safe for UI.

## Assets And Upload

- `POST /api/assets/upload`: multipart upload, optional `folder_id`, returns asset.
- `GET /api/assets/{asset_id}`: asset detail.
- `GET /api/assets/{asset_id}/download`: original file download.
- `GET /api/assets/{asset_id}/thumbnail`: best available thumbnail.
- `GET /api/assets/{asset_id}/preview`: preview image/video/document render when available.
- `DELETE /api/assets/{asset_id}`: logical delete.

## Drive

- `GET /api/drive/items?folder_id=`: folder children and assets.
- `POST /api/drive/folders`: create folder.
- `PATCH /api/drive/folders/{folder_id}`: rename/update folder.
- `PATCH /api/drive/items/{asset_id}`: rename/update asset.
- `POST /api/drive/items/{asset_id}/move`: move asset.

## Photos

- `GET /api/photos/timeline`: grouped photo/video timeline.
- `GET /api/photos/{asset_id}`: photo/video detail.
- `GET /api/photos/albums`: list albums.
- `POST /api/photos/albums`: create album.
- `POST /api/photos/albums/{album_id}/items`: add asset to album.

## Search

- `GET /api/search`: global or scoped search.

## Jobs And Admin

- `GET /api/jobs`: list jobs and statuses.
- `POST /api/jobs/{job_id}/retry`: retry failed job.
- `POST /api/admin/reindex`: enqueue reindex jobs.

## Telegram

- `POST /api/telegram/webhook`: receive bot updates.

## Pagination

List endpoints use `limit` and `cursor` where result sets can grow.
