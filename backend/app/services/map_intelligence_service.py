from __future__ import annotations

import re
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from threading import Lock
from time import monotonic
from typing import Any, Literal

import models
from app.services.live_trends_service import fetch_live_trends
from app.services.region_intelligence_service import map_country_to_region, normalize_country
from sqlalchemy.orm import Session

Scope = Literal["country", "region"]

SUPPORTED_PLATFORM_KEYS = ("youtube", "reddit", "x", "facebook")

_STOPWORDS = {
    "about",
    "after",
    "against",
    "amid",
    "and",
    "are",
    "around",
    "breaking",
    "from",
    "global",
    "into",
    "latest",
    "live",
    "more",
    "news",
    "over",
    "post",
    "reddit",
    "says",
    "social",
    "that",
    "the",
    "their",
    "this",
    "today",
    "trending",
    "update",
    "video",
    "watch",
    "with",
    "world",
    "youtube",
}

_COUNTRY_ALIASES: dict[str, set[str]] = {
    "india": {"india", "in"},
    "in": {"india", "in"},
    "united states": {"united states", "united states of america", "us", "usa"},
    "united states of america": {"united states", "united states of america", "us", "usa"},
    "usa": {"united states", "united states of america", "us", "usa"},
    "us": {"united states", "united states of america", "us", "usa"},
    "united kingdom": {"united kingdom", "uk", "gb"},
    "uk": {"united kingdom", "uk", "gb"},
    "gb": {"united kingdom", "uk", "gb"},
    "australia": {"australia", "au"},
    "au": {"australia", "au"},
    "canada": {"canada", "ca"},
    "ca": {"canada", "ca"},
    "japan": {"japan", "jp"},
    "jp": {"japan", "jp"},
}

_DISPLAY_COUNTRY_NAMES: dict[str, str] = {
    "us": "United States",
    "usa": "United States",
    "united states": "United States",
    "united states of america": "United States",
    "in": "India",
    "india": "India",
    "gb": "United Kingdom",
    "uk": "United Kingdom",
    "united kingdom": "United Kingdom",
    "au": "Australia",
    "australia": "Australia",
    "ca": "Canada",
    "canada": "Canada",
    "jp": "Japan",
    "japan": "Japan",
}

_COORDINATE_KEYS: dict[str, str] = {
    "us": "US",
    "usa": "US",
    "united states": "US",
    "united states of america": "US",
    "gb": "GB",
    "uk": "GB",
    "united kingdom": "GB",
    "ca": "CA",
    "canada": "CA",
    "au": "AU",
    "australia": "AU",
    "de": "DE",
    "germany": "DE",
    "fr": "FR",
    "france": "FR",
    "jp": "JP",
    "japan": "JP",
    "in": "IN",
    "india": "IN",
    "br": "BR",
    "brazil": "BR",
    "mx": "MX",
    "mexico": "MX",
    "ru": "RU",
    "russia": "RU",
    "kr": "KR",
    "south korea": "KR",
    "korea": "KR",
    "za": "ZA",
    "south africa": "ZA",
    "sg": "SG",
    "singapore": "SG",
    "it": "IT",
    "italy": "IT",
    "es": "ES",
    "spain": "ES",
    "ng": "NG",
    "nigeria": "NG",
    "pk": "PK",
    "pakistan": "PK",
    "id": "ID",
    "indonesia": "ID",
    "nl": "NL",
    "netherlands": "NL",
    "se": "SE",
    "sweden": "SE",
    "ch": "CH",
    "switzerland": "CH",
    "ar": "AR",
    "argentina": "AR",
    "tr": "TR",
    "turkey": "TR",
    "ae": "AE",
    "uae": "AE",
    "united arab emirates": "AE",
    "th": "TH",
    "thailand": "TH",
    "ph": "PH",
    "philippines": "PH",
    "vn": "VN",
    "vietnam": "VN",
    "cn": "CN",
    "china": "CN",
}

_REGION_ALIASES = {
    "asia": "Asia",
    "europe": "Europe",
    "north america": "North America",
    "americas": "North America",
    "south america": "South America",
    "africa": "Africa",
    "oceania": "Oceania",
    "middle east": "Middle East",
    "global": "Global",
}

_LIVE_CACHE_TTL_SECONDS = 45.0
_live_cache_lock = Lock()
_live_cache_until = 0.0
_live_cache_rows: list[dict[str, Any]] = []


def _canonical_platform(value: str | None) -> str:
    platform = str(value or "").strip().lower()
    if platform in {"yt", "youtube"}:
        return "youtube"
    if platform in {"reddit"}:
        return "reddit"
    if platform in {"twitter", "x"}:
        return "x"
    if platform in {"facebook", "fb"}:
        return "facebook"
    return platform


def _canonical_region(name: str) -> str:
    return _REGION_ALIASES.get(str(name or "").strip().lower(), str(name or "Global").strip() or "Global")


def _country_match_keys(country_name: str) -> set[str]:
    key = normalize_country(country_name).lower()
    return _COUNTRY_ALIASES.get(key, {key})


def _display_country_name(country_name: str) -> str:
    key = normalize_country(country_name).lower()
    return _DISPLAY_COUNTRY_NAMES.get(key, normalize_country(country_name))


def resolve_country_coord_key(country_name: str) -> str | None:
    key = normalize_country(country_name).lower()
    return _COORDINATE_KEYS.get(key)


def _parse_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    if isinstance(value, str) and value.strip():
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                return parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc)
        except ValueError:
            return None

    return None


def _normalize_row(item: dict[str, Any]) -> dict[str, Any]:
    country = normalize_country(item.get("country", "Global"))
    created_at = _parse_datetime(item.get("created_at"))
    snapshot_time = _parse_datetime(item.get("snapshot_time"))

    return {
        "keyword": str(item.get("keyword", "Signal") or "Signal"),
        "title": str(item.get("title", "") or ""),
        "platform": str(item.get("platform", "Unknown") or "Unknown"),
        "country": country,
        "mentions": int(item.get("mentions", 0) or 0),
        "engagement": int(item.get("engagement", 0) or 0),
        "score": float(item.get("score", 0.0) or 0.0),
        "created_at": created_at.isoformat() if created_at else "",
        "snapshot_time": snapshot_time.isoformat() if snapshot_time else "",
        "source_url": str(item.get("source_url", "#") or "#"),
    }


def _merge_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, str, str], dict[str, Any]] = {}

    for raw_row in rows:
        row = _normalize_row(raw_row)
        key = (
            row["title"].lower(),
            row["platform"].lower(),
            row["country"].lower(),
        )

        existing = grouped.get(key)
        if existing is None:
            grouped[key] = row
            continue

        existing["mentions"] = max(existing["mentions"], row["mentions"])
        existing["engagement"] = max(existing["engagement"], row["engagement"])
        existing["score"] = max(existing["score"], row["score"])

        existing_created = _parse_datetime(existing.get("created_at"))
        incoming_created = _parse_datetime(row.get("created_at"))
        if incoming_created and (existing_created is None or incoming_created > existing_created):
            existing["created_at"] = row["created_at"]

        existing_snapshot = _parse_datetime(existing.get("snapshot_time"))
        incoming_snapshot = _parse_datetime(row.get("snapshot_time"))
        if incoming_snapshot and (existing_snapshot is None or incoming_snapshot > existing_snapshot):
            existing["snapshot_time"] = row["snapshot_time"]

    merged = list(grouped.values())
    merged.sort(
        key=lambda item: (
            float(item.get("score", 0.0) or 0.0),
            int(item.get("engagement", 0) or 0),
            int(item.get("mentions", 0) or 0),
            str(item.get("created_at", "") or ""),
        ),
        reverse=True,
    )
    return merged


def _get_live_rows() -> list[dict[str, Any]]:
    global _live_cache_until, _live_cache_rows

    now = monotonic()
    with _live_cache_lock:
        if now < _live_cache_until and _live_cache_rows:
            return list(_live_cache_rows)

    fresh_rows = fetch_live_trends()
    normalized_rows = [_normalize_row(row) for row in fresh_rows]

    with _live_cache_lock:
        _live_cache_rows = normalized_rows
        _live_cache_until = monotonic() + _LIVE_CACHE_TTL_SECONDS

    return list(normalized_rows)


def _get_historical_rows(db: Session, *, lookback_days: int = 7) -> list[dict[str, Any]]:
    since_dt = datetime.now(timezone.utc) - timedelta(days=lookback_days)
    rows = (
        db.query(models.HistoricalTrend)
        .filter(models.HistoricalTrend.snapshot_time >= since_dt)
        .all()
    )

    return [
        {
            "keyword": row.keyword,
            "title": row.title,
            "platform": row.platform,
            "country": row.country,
            "mentions": row.mentions,
            "engagement": row.engagement,
            "score": row.score,
            "created_at": row.created_at.isoformat() if row.created_at else "",
            "snapshot_time": row.snapshot_time.isoformat() if row.snapshot_time else "",
            "source_url": f"#historical-{row.id}",
        }
        for row in rows
    ]


def _load_combined_rows(db: Session) -> list[dict[str, Any]]:
    return _merge_rows(_get_live_rows() + _get_historical_rows(db))


def _filter_scope_rows(rows: list[dict[str, Any]], *, name: str, scope: Scope) -> list[dict[str, Any]]:
    normalized_name = str(name or "").strip()
    if not normalized_name:
        return rows

    if scope == "country":
        match_keys = _country_match_keys(normalized_name)
        matched = [
            row
            for row in rows
            if normalize_country(row.get("country")).lower() in match_keys
        ]
        if matched:
            return matched

        needle = normalized_name.lower()
        substring_rows = [
            row for row in rows if needle in normalize_country(row.get("country")).lower()
        ]
        return substring_rows

    region_name = _canonical_region(normalized_name)
    if region_name == "Global":
        return rows

    regional_rows = [
        row
        for row in rows
        if map_country_to_region(row.get("country")) == region_name
    ]
    if regional_rows:
        return regional_rows

    match_keys = _country_match_keys(normalized_name)
    return [
        row
        for row in rows
        if normalize_country(row.get("country")).lower() in match_keys
    ]


def _filter_platform_rows(rows: list[dict[str, Any]], platform: str | None) -> list[dict[str, Any]]:
    canonical_platform = _canonical_platform(platform)
    if not canonical_platform or canonical_platform == "all":
        return rows

    return [
        row
        for row in rows
        if _canonical_platform(str(row.get("platform"))) == canonical_platform
    ]


def _extract_hashtags(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    explicit_tags: Counter[str] = Counter()
    inferred_tokens: Counter[str] = Counter()

    for row in rows[:15]:
        text = f"{row.get('keyword', '')} {row.get('title', '')}"
        for tag in re.findall(r"#([A-Za-z0-9_]{2,40})", text):
            explicit_tags[f"#{tag.lower()}"] += 1

        for token in re.findall(r"[A-Za-z][A-Za-z0-9'-]{3,}", text.lower()):
            if token in _STOPWORDS:
                continue
            inferred_tokens[f"#{token}"] += 1

    ranked = explicit_tags or inferred_tokens
    return [
        {"tag": tag, "count": count}
        for tag, count in ranked.most_common(8)
    ]


def _build_platform_buckets(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    buckets = {platform_key: [] for platform_key in SUPPORTED_PLATFORM_KEYS}

    for row in rows:
        platform_key = _canonical_platform(str(row.get("platform")))
        if platform_key in buckets and len(buckets[platform_key]) < 6:
            buckets[platform_key].append(row)

    return buckets


def _build_trend_volume(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    volume_map: dict[str, dict[str, float]] = defaultdict(lambda: {"count": 0.0, "score_total": 0.0})

    for row in rows:
        snapshot_dt = _parse_datetime(row.get("snapshot_time")) or _parse_datetime(row.get("created_at"))
        if snapshot_dt is None:
            continue
        date_key = snapshot_dt.date().isoformat()
        volume_map[date_key]["count"] += 1
        volume_map[date_key]["score_total"] += float(row.get("score", 0.0) or 0.0)

    series = []
    for date_key in sorted(volume_map.keys())[-7:]:
        count = int(volume_map[date_key]["count"])
        total_score = float(volume_map[date_key]["score_total"])
        series.append(
            {
                "date": date_key,
                "count": count,
                "avg_score": round(total_score / count, 2) if count else 0.0,
            }
        )
    return series


def _build_summary(name: str, rows: list[dict[str, Any]], trend_volume: list[dict[str, Any]]) -> str:
    if not rows:
        return f"No strong live intelligence signals are currently mapped to {name}. The panel is standing by for the next signal wave."

    lead = rows[0]
    active_platforms = sorted({_canonical_platform(str(row.get("platform"))) for row in rows if row.get("platform")})
    platform_phrase = ", ".join(platform.title() for platform in active_platforms[:3]) or "cross-platform channels"
    volume_phrase = ""

    if len(trend_volume) >= 2:
        latest = trend_volume[-1]["count"]
        previous = trend_volume[-2]["count"]
        if latest > previous:
            volume_phrase = " Volume is accelerating versus the prior snapshot window."
        elif latest < previous:
            volume_phrase = " Volume is cooling versus the prior snapshot window."
        else:
            volume_phrase = " Volume is holding steady against the prior snapshot window."

    return (
        f"{name} intelligence is currently led by '{lead.get('keyword', 'Signal')}' on "
        f"{lead.get('platform', 'mixed feeds')} with a score of {float(lead.get('score', 0.0)):.1f}. "
        f"{len(rows)} ranked signals are active across {platform_phrase}.{volume_phrase}"
    )


def _build_score_metrics(rows: list[dict[str, Any]]) -> dict[str, Any]:
    if not rows:
        return {
            "average": 0.0,
            "peak": 0.0,
            "mentions": 0,
            "engagement": 0,
        }

    total_score = sum(float(row.get("score", 0.0) or 0.0) for row in rows)
    total_mentions = sum(int(row.get("mentions", 0) or 0) for row in rows)
    total_engagement = sum(int(row.get("engagement", 0) or 0) for row in rows)

    return {
        "average": round(total_score / len(rows), 2),
        "peak": round(max(float(row.get("score", 0.0) or 0.0) for row in rows), 2),
        "mentions": total_mentions,
        "engagement": total_engagement,
    }


def _serialize_trends(rows: list[dict[str, Any]], *, limit: int) -> list[dict[str, Any]]:
    return [
        {
            "keyword": row.get("keyword", ""),
            "title": row.get("title", ""),
            "platform": row.get("platform", ""),
            "country": _display_country_name(str(row.get("country", "Global"))),
            "mentions": int(row.get("mentions", 0) or 0),
            "engagement": int(row.get("engagement", 0) or 0),
            "created_at": row.get("created_at", ""),
            "source_url": row.get("source_url", ""),
            "score": round(float(row.get("score", 0.0) or 0.0), 2),
        }
        for row in rows[:limit]
    ]


def build_location_intelligence(
    db: Session,
    *,
    name: str,
    scope: Scope,
    platform: str | None = None,
) -> dict[str, Any]:
    display_name = _display_country_name(name) if scope == "country" else _canonical_region(name)
    combined_rows = _load_combined_rows(db)
    scoped_rows = _filter_scope_rows(combined_rows, name=name, scope=scope)

    if scope == "country" and not scoped_rows:
        discovered_rows = fetch_live_trends(
            platform=platform if platform and platform != "all" else "all",
            query=display_name,
        )
        scoped_rows = [
            {
                **row,
                "country": display_name,
                "keyword": row.get("keyword") or display_name,
            }
            for row in discovered_rows
        ]

    platform_rows = _filter_platform_rows(scoped_rows, platform)

    score_sorted_rows = sorted(
        platform_rows,
        key=lambda row: (
            float(row.get("score", 0.0) or 0.0),
            int(row.get("engagement", 0) or 0),
            int(row.get("mentions", 0) or 0),
            str(row.get("created_at", "") or ""),
        ),
        reverse=True,
    )
    recent_rows = sorted(
        platform_rows,
        key=lambda row: _parse_datetime(row.get("created_at")) or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )

    historical_rows = _get_historical_rows(db)
    scoped_history = _filter_scope_rows(historical_rows, name=name, scope=scope)
    scoped_history = _filter_platform_rows(scoped_history, platform)
    trend_volume = _build_trend_volume(scoped_history or platform_rows)

    payload: dict[str, Any] = {
        "country": display_name if scope == "country" else "",
        "region": _canonical_region(name) if scope == "region" else map_country_to_region(display_name),
        "top_trends": _serialize_trends(score_sorted_rows, limit=8),
        "hashtags": _extract_hashtags(score_sorted_rows),
        "platforms": {
            platform_key: _serialize_trends(rows, limit=6)
            for platform_key, rows in _build_platform_buckets(score_sorted_rows).items()
        },
        "recent_content": _serialize_trends(recent_rows, limit=8),
        "summary": _build_summary(display_name, score_sorted_rows, trend_volume),
        "trend_volume": trend_volume,
        "trend_score": _build_score_metrics(score_sorted_rows),
    }

    if scope == "region":
        payload["country"] = display_name

    return payload


def build_map_hotspots(rows: list[dict[str, Any]], country_coords: dict[str, dict[str, float]]) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}

    for row in rows:
        country = normalize_country(row.get("country", "Global"))
        coord_key = resolve_country_coord_key(country)
        if not coord_key or coord_key not in country_coords:
            continue

        display_name = _display_country_name(country)
        entry = grouped.setdefault(
            display_name,
            {
                "country": display_name,
                "coord_key": coord_key,
                "count": 0,
                "score_total": 0.0,
                "top_keyword": str(row.get("keyword", "Trending") or "Trending"),
            },
        )
        entry["count"] += 1
        entry["score_total"] += float(row.get("score", 0.0) or 0.0)
        if float(row.get("score", 0.0) or 0.0) >= float(entry["score_total"] / max(entry["count"], 1)):
            entry["top_keyword"] = str(row.get("keyword", "Trending") or "Trending")

    hotspots = []
    for display_name, entry in grouped.items():
        coords = country_coords[entry["coord_key"]]
        average_score = float(entry["score_total"]) / max(int(entry["count"]), 1)
        hotspots.append(
            {
                "country": display_name,
                "lat": coords["lat"],
                "lng": coords["lng"],
                "score": round((average_score * 0.75) + min(entry["count"], 10) * 2.5, 2),
                "category": entry["top_keyword"],
            }
        )

    hotspots.sort(key=lambda item: float(item["score"]), reverse=True)
    return hotspots
