from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import models
from app.services.live_trends_service import fetch_live_trends
from sqlalchemy.orm import Session

REGION_ORDER = [
    "Asia",
    "Europe",
    "North America",
    "South America",
    "Africa",
    "Oceania",
    "Middle East",
    "Global",
]

_REGION_COUNTRIES: dict[str, set[str]] = {
    "Asia": {
        "india",
        "china",
        "japan",
        "south korea",
        "korea",
        "indonesia",
        "pakistan",
        "bangladesh",
        "philippines",
        "vietnam",
        "thailand",
        "singapore",
        "malaysia",
        "sri lanka",
        "nepal",
        "taiwan",
        "hong kong",
        "in",
        "cn",
        "jp",
        "kr",
        "id",
        "pk",
        "bd",
        "ph",
        "vn",
        "th",
        "sg",
        "my",
        "lk",
        "np",
        "tw",
        "hk",
    },
    "Europe": {
        "united kingdom",
        "uk",
        "germany",
        "france",
        "italy",
        "spain",
        "netherlands",
        "poland",
        "sweden",
        "norway",
        "finland",
        "denmark",
        "ireland",
        "ukraine",
        "russia",
        "turkey",
        "gb",
        "de",
        "fr",
        "it",
        "es",
        "nl",
        "pl",
        "se",
        "no",
        "fi",
        "dk",
        "ie",
        "ua",
        "ru",
        "tr",
    },
    "North America": {
        "united states",
        "usa",
        "us",
        "canada",
        "mexico",
        "ca",
        "mx",
    },
    "South America": {
        "brazil",
        "argentina",
        "colombia",
        "chile",
        "peru",
        "venezuela",
        "br",
        "ar",
        "co",
        "cl",
        "pe",
        "ve",
    },
    "Africa": {
        "nigeria",
        "south africa",
        "kenya",
        "egypt",
        "ethiopia",
        "ghana",
        "morocco",
        "tz",
        "za",
        "ke",
        "eg",
        "et",
        "gh",
        "ma",
        "ng",
    },
    "Oceania": {
        "australia",
        "new zealand",
        "au",
        "nz",
    },
    "Middle East": {
        "israel",
        "saudi arabia",
        "uae",
        "united arab emirates",
        "qatar",
        "iran",
        "iraq",
        "jordan",
        "lebanon",
        "kuwait",
        "bahrain",
        "oman",
        "il",
        "sa",
        "ae",
        "qa",
        "ir",
        "iq",
        "jo",
        "lb",
        "kw",
        "bh",
        "om",
    },
}

_COUNTRY_ALIASES: dict[str, set[str]] = {
    "india": {"india", "in"},
    "in": {"india", "in"},
    "united states": {"united states", "usa", "us"},
    "usa": {"united states", "usa", "us"},
    "us": {"united states", "usa", "us"},
    "united kingdom": {"united kingdom", "uk", "gb"},
    "uk": {"united kingdom", "uk", "gb"},
    "gb": {"united kingdom", "uk", "gb"},
    "uae": {"uae", "united arab emirates", "ae"},
    "united arab emirates": {"uae", "united arab emirates", "ae"},
    "ae": {"uae", "united arab emirates", "ae"},
}


def normalize_country(country: Any) -> str:
    return str(country or "Global").strip() or "Global"


def _country_lookup_key(country: Any) -> str:
    return normalize_country(country).lower()


def _country_match_keys(country: Any) -> set[str]:
    key = _country_lookup_key(country)
    return _COUNTRY_ALIASES.get(key, {key})


def map_country_to_region(country: Any) -> str:
    normalized = _country_lookup_key(country)
    if normalized in {"global", "world", "worldwide", "all"}:
        return "Global"

    for region_name in REGION_ORDER:
        if region_name == "Global":
            continue
        if normalized in _REGION_COUNTRIES.get(region_name, set()):
            return region_name

    return "Global"


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


def _merge_trend_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, str, str], dict[str, Any]] = {}

    for item in rows:
        title = str(item.get("title", "") or "")
        platform = str(item.get("platform", "") or "")
        country = normalize_country(item.get("country", "Global"))
        key = (title.lower(), platform.lower(), country.lower())

        existing = grouped.get(key)
        if existing is None:
            grouped[key] = {
                "keyword": str(item.get("keyword", "Signal") or "Signal"),
                "title": title,
                "platform": platform,
                "country": country,
                "mentions": int(item.get("mentions", 0) or 0),
                "engagement": int(item.get("engagement", 0) or 0),
                "score": float(item.get("score", 0.0) or 0.0),
                "created_at": item.get("created_at") or "",
                "source_url": str(item.get("source_url", "#") or "#"),
            }
            continue

        existing["mentions"] = max(existing["mentions"], int(item.get("mentions", 0) or 0))
        existing["engagement"] = max(existing["engagement"], int(item.get("engagement", 0) or 0))
        existing["score"] = max(existing["score"], float(item.get("score", 0.0) or 0.0))

        incoming_created = _parse_datetime(item.get("created_at"))
        current_created = _parse_datetime(existing.get("created_at"))
        if incoming_created and (current_created is None or incoming_created > current_created):
            existing["created_at"] = incoming_created.isoformat()

    merged = list(grouped.values())
    merged.sort(
        key=lambda trend: (
            float(trend.get("score", 0.0) or 0.0),
            int(trend.get("engagement", 0) or 0),
            int(trend.get("mentions", 0) or 0),
            str(trend.get("created_at", "") or ""),
        ),
        reverse=True,
    )
    return merged


def _load_historical_rows(db: Session, lookback_days: int = 7) -> list[dict[str, Any]]:
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
            "source_url": f"#historical-{row.id}",
        }
        for row in rows
    ]


def _load_combined_rows(db: Session) -> list[dict[str, Any]]:
    live_rows = fetch_live_trends()
    historical_rows = _load_historical_rows(db=db, lookback_days=7)
    return _merge_trend_rows(live_rows + historical_rows)


def get_available_regions(db: Session) -> list[dict[str, Any]]:
    combined = _load_combined_rows(db)
    region_counts: dict[str, int] = {region: 0 for region in REGION_ORDER}

    for trend in combined:
        region = map_country_to_region(trend.get("country"))
        region_counts[region] = region_counts.get(region, 0) + 1

    return [
        {
            "name": region,
            "trend_count": region_counts.get(region, 0),
        }
        for region in REGION_ORDER
    ]


def get_region_trends(
    db: Session,
    *,
    region_name: str | None = None,
    country: str | None = None,
    limit: int = 20,
) -> tuple[str, list[dict[str, Any]]]:
    combined = _load_combined_rows(db)

    if country:
        selected_country = normalize_country(country)
        match_keys = _country_match_keys(selected_country)
        filtered = [
            trend
            for trend in combined
            if _country_lookup_key(trend.get("country")) in match_keys
        ]
        return map_country_to_region(selected_country), filtered[:limit]

    selected_region = region_name or "Global"
    if selected_region not in REGION_ORDER:
        raise ValueError(
            f"Unsupported region '{selected_region}'. Expected one of: {', '.join(REGION_ORDER)}"
        )

    if selected_region == "Global":
        return selected_region, combined[:limit]

    filtered = [
        trend
        for trend in combined
        if map_country_to_region(trend.get("country")) == selected_region
    ]
    return selected_region, filtered[:limit]
