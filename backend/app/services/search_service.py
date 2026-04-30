from __future__ import annotations

from collections import Counter
from datetime import datetime
from typing import Any

import models
from app.services.live_trends_service import fetch_live_trends
from app.services.region_intelligence_service import map_country_to_region, normalize_country
from sqlalchemy import or_
from sqlalchemy.orm import Session


def _normalize_text(value: Any) -> str:
    return str(value or "").strip().lower()


def _parse_iso_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str) and value.strip():
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def _text_match_score(query: str, keyword: str, title: str) -> float:
    score = 0.0
    q = _normalize_text(query)
    kw = _normalize_text(keyword)
    tt = _normalize_text(title)

    if not q:
        return score

    if kw == q:
        score += 120.0
    if tt == q:
        score += 140.0

    if q in kw:
        score += 70.0
    if q in tt:
        score += 80.0

    query_tokens = [token for token in q.split() if token]
    for token in query_tokens:
        if token in kw:
            score += 22.0
        if token in tt:
            score += 26.0

    return score


def _rank_item(item: dict[str, Any], query: str) -> float:
    text_score = _text_match_score(query, item.get("keyword", ""), item.get("title", ""))
    score = float(item.get("score", 0.0) or 0.0)
    engagement = int(item.get("engagement", 0) or 0)
    mentions = int(item.get("mentions", 0) or 0)

    return text_score + (score * 0.5) + (engagement * 0.0002) + (mentions * 0.0001)


def _matches_query(item: dict[str, Any], query: str) -> bool:
    q = _normalize_text(query)
    if not q:
        return True

    haystack = " ".join(
        [
            _normalize_text(item.get("keyword", "")),
            _normalize_text(item.get("title", "")),
        ]
    )
    if q in haystack:
        return True

    return all(token in haystack for token in q.split() if token)


def _serialize_historical_row(row: models.HistoricalTrend) -> dict[str, Any]:
    return {
        "id": row.id,
        "keyword": row.keyword,
        "title": row.title,
        "platform": row.platform,
        "country": normalize_country(row.country),
        "mentions": int(row.mentions or 0),
        "engagement": int(row.engagement or 0),
        "score": float(row.score or 0.0),
        "created_at": row.created_at.isoformat() if row.created_at else "",
        "snapshot_time": row.snapshot_time.isoformat() if row.snapshot_time else "",
        "source_url": f"#historical-{row.id}",
    }


def search_events(db: Session, query: str, limit: int = 20) -> dict[str, Any]:
    q = (query or "").strip()
    if not q:
        return {
            "live_matches": [],
            "historical_matches": [],
            "top_regions": [],
            "top_platforms": [],
            "related_keywords": [],
        }

    live_items = [item for item in fetch_live_trends() if _matches_query(item, q)]
    live_items.sort(key=lambda item: _rank_item(item, q), reverse=True)
    live_matches = live_items[:limit]

    historical_rows = (
        db.query(models.HistoricalTrend)
        .filter(
            or_(
                models.HistoricalTrend.keyword.ilike(f"%{q}%"),
                models.HistoricalTrend.title.ilike(f"%{q}%"),
            )
        )
        .order_by(models.HistoricalTrend.snapshot_time.desc())
        .limit(max(limit * 10, 200))
        .all()
    )

    stored_keyword_rows = (
        db.query(models.Trend)
        .filter(models.Trend.keyword.ilike(f"%{q}%"))
        .order_by(models.Trend.created_at.desc())
        .limit(100)
        .all()
    )

    historical_items = [_serialize_historical_row(row) for row in historical_rows]

    for stored in stored_keyword_rows:
        historical_items.append(
            {
                "id": f"trend-{stored.id}",
                "keyword": stored.keyword,
                "title": stored.keyword,
                "platform": stored.platform or "Unknown",
                "country": normalize_country(stored.country),
                "mentions": int(stored.mentions or 0),
                "engagement": int(stored.engagement or 0),
                "score": float(stored.trend_score or 0.0),
                "created_at": stored.created_at.isoformat() if stored.created_at else "",
                "snapshot_time": stored.created_at.isoformat() if stored.created_at else "",
                "source_url": f"#stored-{stored.id}",
            }
        )

    deduped: dict[tuple[str, str, str], dict[str, Any]] = {}
    for item in historical_items:
        key = (
            _normalize_text(item.get("title", "")),
            _normalize_text(item.get("keyword", "")),
            _normalize_text(item.get("platform", "")),
        )
        existing = deduped.get(key)
        if existing is None or _rank_item(item, q) > _rank_item(existing, q):
            deduped[key] = item

    historical_ranked = sorted(deduped.values(), key=lambda item: _rank_item(item, q), reverse=True)
    historical_matches = historical_ranked[:limit]

    all_matches = live_matches + historical_matches

    region_counter = Counter(
        map_country_to_region(item.get("country", "Global")) for item in all_matches
    )
    platform_counter = Counter(str(item.get("platform", "Unknown") or "Unknown") for item in all_matches)
    keyword_counter = Counter(
        _normalize_text(item.get("keyword", ""))
        for item in all_matches
        if _normalize_text(item.get("keyword", ""))
    )

    normalized_query = _normalize_text(q)
    related_keywords = [
        keyword
        for keyword, _count in keyword_counter.most_common(12)
        if keyword != normalized_query
    ][:8]

    return {
        "live_matches": live_matches,
        "historical_matches": historical_matches,
        "top_regions": [
            {"name": name, "count": count}
            for name, count in region_counter.most_common(8)
        ],
        "top_platforms": [
            {"name": name, "count": count}
            for name, count in platform_counter.most_common(8)
        ],
        "related_keywords": related_keywords,
    }
