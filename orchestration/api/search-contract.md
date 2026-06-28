# Search Contract

## Request

`GET /api/search?q=&type=&folder_id=&date_from=&date_to=&limit=&cursor=`

Parameters:

- `q`: search text.
- `type`: optional result/media type filter.
- `folder_id`: optional Drive scope.
- `date_from`, `date_to`: optional date filters.
- `limit`: default `50`.
- `cursor`: pagination cursor.

## Response

```json
{
  "items": [
    {
      "id": "hit-id",
      "type": "photo",
      "asset_id": "asset-id",
      "title": "IMG_001.jpg",
      "subtitle": "Mar 2026",
      "thumbnail_url": "/api/assets/asset-id/thumbnail",
      "score": 0.91,
      "reason": "Coincidio por OCR y tipo de documento",
      "processing_state": "indexed"
    }
  ],
  "facets": [
    { "type": "photo", "count": 12 }
  ],
  "next_cursor": null
}
```

## Requirements

- Include explanation for every result.
- Include processing/indexing state.
- Degrade without OCR or embeddings.
- Search folders and albums as first-class results.
- Apply Drive/Photos scoped filters when requested.
