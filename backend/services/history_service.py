from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import models
from app.services.live_trends_service import fetch_live_trends
from database import SessionLocal, engine


def _normalize_pair(title: Any, platform: Any) -> tuple[str, str]:
    return str(title or "").strip().lower(), str(platform or "").strip().lower()


def _parse_created_at(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value

    if isinstance(value, str) and value.strip():
        raw_value = value.strip().replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(raw_value)
        except ValueError:
            return None

    return None


def save_live_snapshot() -> dict[str, int]:
    """
    Fetch current live trends and persist them to the HistoricalTrend table.

    Duplicate protection:
    - Skip entries that share the same (title, platform) within the same UTC hour.
    """
    models.Base.metadata.create_all(bind=engine)

    live_trends = fetch_live_trends()
    if not live_trends:
        return {"saved": 0, "skipped_duplicates": 0, "total_live": 0}

    current_utc = datetime.now(timezone.utc)
    hour_start = current_utc.replace(minute=0, second=0, microsecond=0)
    hour_end = hour_start + timedelta(hours=1)

    saved = 0
    skipped_duplicates = 0

    db = SessionLocal()
    try:
        existing_rows = (
            db.query(models.HistoricalTrend.title, models.HistoricalTrend.platform)
            .filter(models.HistoricalTrend.snapshot_time >= hour_start)
            .filter(models.HistoricalTrend.snapshot_time < hour_end)
            .all()
        )
        existing_pairs = {_normalize_pair(title, platform) for title, platform in existing_rows}

        for item in live_trends:
            title = item.get("title", "")
            platform = item.get("platform", "")
            pair = _normalize_pair(title, platform)

            if pair in existing_pairs:
                skipped_duplicates += 1
                continue

            historical_trend = models.HistoricalTrend(
                title=str(title or ""),
                keyword=str(item.get("keyword", "") or ""),
                platform=str(platform or ""),
                country=str(item.get("country", "") or ""),
                mentions=int(item.get("mentions", 0) or 0),
                engagement=int(item.get("engagement", 0) or 0),
                score=float(item.get("score", 0.0) or 0.0),
                created_at=_parse_created_at(item.get("created_at")),
                snapshot_time=current_utc,
            )

            db.add(historical_trend)
            existing_pairs.add(pair)
            saved += 1

        db.commit()
        return {
            "saved": saved,
            "skipped_duplicates": skipped_duplicates,
            "total_live": len(live_trends),
        }
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
