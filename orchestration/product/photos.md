# Product: Photos

## Scope

Photos provides a Google Photos-like local experience for image and basic video assets.

## Required Behavior

- Timeline by date.
- Virtualized photo grid.
- Group by day/month.
- Open photo in lightbox.
- Open basic video viewer.
- Toggle favorite.
- Simple albums.
- Add/remove photos from albums.
- Upload photos.
- Show indexing state.
- Search within photos.

## Domain Rules

- Photo timeline uses `taken_at` when available, otherwise created/imported time.
- Albums are metadata collections; assets can belong to multiple albums.
- Favorites are stored on assets.
- Videos are supported at basic preview/playback level; no deep video indexing in MVP.

## UI States

- Empty timeline.
- Thumbnail pending.
- OCR/embedding pending.
- Partial failure.
- Album empty.

## Ownership

User-visible behavior owner: photos-ui agent.

Supporting stages: domain-contracts, sqlite-data, ingestion-media, and hybrid-search provide backend contracts and APIs only.
