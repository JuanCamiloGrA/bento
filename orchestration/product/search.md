# Product: Global Search

## Scope

Global search finds assets, folders, photos, videos, documents, PDF pages, OCR blocks, and albums using name, folder, OCR, metadata, date, type, and optional semantic embeddings.

## Endpoint

`GET /api/search?q=&type=&folder_id=&date_from=&date_to=&limit=&cursor=`

## Result Types

- `asset`
- `folder`
- `photo`
- `video`
- `document`
- `pdf_page`
- `ocr_block`
- `album`

## Required Behavior

- Search by filename.
- Search by folder.
- Search by OCR text.
- Search by textual metadata.
- Filter/boost by date.
- Filter by type.
- Semantic image search when embeddings are indexed.
- Grouped UI results.
- Type filters.
- Match explanation for every result.
- Thumbnail preview when available.
- Show "indexing" state when OCR/embeddings are missing.
- Documents sidebar view as a filtered search/list for document and PDF assets.

## Scoring

```txt
score_final =
  text_score * w_text
+ vector_score * w_vector
+ metadata_score * w_meta
+ recency_score * w_recency
```

Rules:

- If query contains numbers, emails, document-like names, or terms like `cedula`, `factura`, `contrato`, `pasaporte`, boost text and metadata.
- If query describes a scene, boost vector score.
- If query contains date/month/year, apply temporal filter or boost.
- If embeddings are disabled/unavailable, vector score is omitted.

## Explanation

Every result includes a human-readable reason, such as `Coincidio por OCR y tipo de documento`.

## Ownership

Backend behavior owner: hybrid-search agent.

User-visible Search UI and Documents view owner: search-ui agent.
