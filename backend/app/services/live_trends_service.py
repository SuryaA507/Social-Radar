import logging
import math
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Callable

from app.services.reddit_rss_service import fetch_reddit_rss_trends
from app.services.youtube_service import fetch_youtube_trends

logger = logging.getLogger(__name__)

MAX_LIVE_RESULTS = 25


def _normalize_metric(value: int | float) -> float:
    numeric_value = max(float(value or 0), 0.0)
    if numeric_value == 0:
        return 0.0
    return math.log10(numeric_value + 1) * 100


def _compute_score(mentions: int | float, engagement: int | float) -> float:
    normalized_mentions = _normalize_metric(mentions)
    normalized_engagement = _normalize_metric(engagement)
    return round((normalized_mentions * 0.6) + (normalized_engagement * 0.4), 2)


def _normalize_item(item: dict[str, Any]) -> dict[str, Any]:
    mentions = int(item.get("mentions", 0) or 0)
    engagement = int(item.get("engagement", 0) or 0)

    return {
        "keyword": item.get("keyword", ""),
        "title": item.get("title", ""),
        "platform": item.get("platform", ""),
        "country": item.get("country", ""),
        "mentions": mentions,
        "engagement": engagement,
        "created_at": item.get("created_at", ""),
        "source_url": item.get("source_url", ""),
        "score": _compute_score(mentions, engagement),
    }


def fetch_live_trends() -> list[dict[str, Any]]:
    """
    Fetch live trends from all sources (Reddit, YouTube).
    
    Always returns valid list combining available sources.
    If one source fails, returns remaining sources.
    Never raises exceptions; logs failures instead.
    """
    fetchers: dict[str, Callable[[], list[dict[str, Any]]]] = {
        "reddit": fetch_reddit_rss_trends,
        "youtube": fetch_youtube_trends,
    }

    combined_results: list[dict[str, Any]] = []
    failed_sources = []

    with ThreadPoolExecutor(max_workers=2) as executor:
        future_map = {
            executor.submit(fetcher): source_name for source_name, fetcher in fetchers.items()
        }

        for future in as_completed(future_map):
            source_name = future_map[future]
            try:
                items = future.result()
                if items:
                    # Safely normalize each item
                    for item in items:
                        try:
                            normalized = _normalize_item(item)
                            combined_results.append(normalized)
                        except Exception as exc:
                            logger.debug("[LIVE] Failed to normalize %s item: %s", source_name, exc)
                            continue
                else:
                    logger.info("[LIVE] %s returned empty results", source_name)
            except Exception as exc:
                failed_sources.append(source_name)
                logger.warning("[LIVE] Failed to fetch from %s: %s", source_name, exc)
                continue

    if failed_sources:
        logger.warning("[LIVE] Recovered from %s; returning %d trend(s)", 
                      ", ".join(failed_sources), len(combined_results))

    combined_results.sort(
        key=lambda item: (
            item["score"],
            item["engagement"],
            item["mentions"],
            item["created_at"],
        ),
        reverse=True,
    )
    return combined_results[:MAX_LIVE_RESULTS]
