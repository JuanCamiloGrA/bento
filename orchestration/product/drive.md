# Product: Drive

## Scope

Drive is a logical file manager over local metadata and blobs.

## Required Behavior

- Create folder.
- List folder contents.
- Upload file to folder.
- Rename file.
- Rename folder.
- Move file.
- Move folder.
- Logical delete for files and folders.
- Download file.
- Show preview when available.
- Search within Drive.
- Breadcrumb navigation.
- Grid/list toggle.
- Folder and file cards.
- Drag-and-drop upload.
- Context menu actions.

## Domain Rules

- Folder hierarchy is stored in SQLite, not Telegram.
- Deleted items set `deleted_at`; do not immediately purge blobs.
- Moves must prevent cycles.
- Folder list and item list support pagination when large.
- Drive search is a filtered global search scoped by folder or Drive mode.

## UI States

- Empty folder.
- Uploading.
- Indexing/thumbnail pending.
- Partial failure.
- Offline/local mode with no Telegram.

## Ownership

User-visible behavior owner: drive-ui agent.

Supporting stages: domain-contracts, sqlite-data, ingestion-media, and hybrid-search provide backend contracts and APIs only.
