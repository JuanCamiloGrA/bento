# Boundaries And Layers

## Dependency Rule

```txt
interfaces -> application -> domain
adapters -> ports
infrastructure -> adapters
domain -> no external imports
```

Allowed imports:

- `domain`: standard library only.
- `ports`: standard library, typing, domain types.
- `application`: domain and ports.
- `adapters`: domain, ports, infrastructure helpers when needed.
- `infrastructure`: adapters, config, DB engine/session, logging.
- `interfaces`: application services, DTO mappers, dependency wiring.

Forbidden imports:

- `domain` importing FastAPI, SQLAlchemy, Pydantic, Telegram, OCR, embeddings, ffmpeg, filesystem adapters, or React concepts.
- React components importing backend internals or duplicating backend business rules.
- Endpoints directly using SQLAlchemy models when an application use case exists.

## Ports

Required ports:

- `BlobStorePort`
- `AssetRepositoryPort`
- `FolderRepositoryPort`
- `SearchIndexPort`
- `EmbeddingProviderPort`
- `OCRProviderPort`
- `ThumbnailPort`
- `JobQueuePort`
- `EncryptionPort`
- `ManifestJournalPort`
- `SettingsRepositoryPort`

## Use Case Pattern

- Use cases accept validated command/query DTOs.
- Use cases return domain/application result DTOs.
- Use cases depend on ports, not adapters.
- HTTP schemas map to/from use case DTOs at the interface boundary.

## Domain Modules

- `assets`: assets, variants, metadata, processing state.
- `drive`: folders, drive items, move/rename operations.
- `photos`: timeline, albums, favorites.
- `search`: query intent, hits, facets, explanations.
- `indexing`: indexable units, OCR blocks, embedding records, PDF pages, video segments.
- `jobs`: job entity, status, type, attempts.
- `storage`: blob refs and object kinds.
- `security`: encryption metadata and policy.
- `settings`: runtime configuration exposed to UI.
