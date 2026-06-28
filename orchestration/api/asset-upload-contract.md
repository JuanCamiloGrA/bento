# Asset Upload Contract

## Request

`POST /api/assets/upload`

Multipart fields:

- `file`: required.
- `folder_id`: optional.
- `mode`: optional, `drive` or `photos`; inferred from file kind when omitted.

## Success Response

```json
{
  "id": "asset-id",
  "kind": "image",
  "mode": "photos",
  "folder_id": "folder-id",
  "filename": "IMG_001.jpg",
  "mime_type": "image/jpeg",
  "size_bytes": 12345,
  "sha256": "...",
  "favorite": false,
  "processing_state": "thumbnail_pending",
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-01T00:00:00Z"
}
```

## Backend Requirements

- Save to temp path.
- Compute sha256 before permanent blob storage.
- Deduplicate.
- Store through selected blob store.
- Create `assets` and `blob_refs`.
- Enqueue thumbnail/OCR/embedding jobs as applicable.
- Return before background jobs complete.

## Duplicate Behavior

If sha256 already exists and is not deleted, return existing asset with HTTP `200` and include a duplicate indicator in response metadata, or return `409 duplicate_asset` if the request explicitly disallows duplicates.

Assumption: default MVP behavior returns the existing asset to keep uploads idempotent.
