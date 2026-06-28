# Product: Jobs

## Scope

Jobs run progressive background work without blocking the UI.

## Required Behavior

- Persistent SQLite queue.
- Controlled worker concurrency.
- Claim next job.
- Complete job.
- Fail job with error.
- Retry with backoff.
- List jobs in UI/API.
- Retry failed job through API.
- Admin reindex endpoint.
- Visible status/job indicator in UI.

## Job Types

- `thumbnail`
- `metadata`
- `ocr`
- `embedding`
- `pdf_thumbnail`
- `video_thumbnail`
- `reindex`
- `telegram_import`
- `journal_export`

## Statuses

- `queued`
- `running`
- `succeeded`
- `failed`
- `retrying`

## Ownership

Backend queue owner: sqlite-data agent.
Worker dispatch owner: ingestion-media agent for media handlers, ocr-indexing and embeddings agents for their handlers.
Frontend owner: jobs-settings-ui agent.
