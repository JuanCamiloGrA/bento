from __future__ import annotations

from datetime import UTC, datetime

from bento.application.search import QueryIntent
from bento.application.search.parser import parse_search_query
from bento.application.search.scoring import ScoreParts, ScoreWeights, fuse_scores, recency_score, weights_for_intent


def test_query_intent_parses_document_scene_and_dates() -> None:
    document = parse_search_query("factura 123 cedula user@example.com")
    assert document.intent == QueryIntent.DOCUMENT

    scene = parse_search_query("playa con cielo azul")
    assert scene.intent == QueryIntent.SCENE

    dated = parse_search_query("marzo 2026")
    assert dated.intent == QueryIntent.DATE
    assert dated.date_from == datetime(2026, 3, 1, tzinfo=UTC)
    assert dated.date_to == datetime(2026, 3, 31, 23, 59, 59, 999999, tzinfo=UTC)


def test_weights_boost_document_text_metadata_and_scene_vectors() -> None:
    document_weights = weights_for_intent(QueryIntent.DOCUMENT, vector_available=True)
    scene_weights = weights_for_intent(QueryIntent.SCENE, vector_available=True)

    assert document_weights.text > document_weights.vector
    assert document_weights.metadata > document_weights.vector
    assert scene_weights.vector > scene_weights.text


def test_fusion_omits_vector_weight_when_embeddings_disabled() -> None:
    weights = weights_for_intent(QueryIntent.SCENE, vector_available=False)
    assert weights.vector == 0.0
    assert round(weights.text + weights.metadata + weights.recency, 6) == 1.0

    score = fuse_scores(
        ScoreParts(text=0.5, vector=1.0, metadata=0.5, recency=0.0),
        ScoreWeights(text=0.4, vector=0.0, metadata=0.4, recency=0.2),
    )
    assert score == 0.4


def test_recency_score_prefers_recent_assets() -> None:
    now = datetime(2026, 6, 1, tzinfo=UTC)
    recent = recency_score(now, datetime(2026, 5, 31, tzinfo=UTC))
    older = recency_score(now, datetime(2025, 6, 1, tzinfo=UTC))

    assert recent > older
