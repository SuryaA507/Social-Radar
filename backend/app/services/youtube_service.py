import os
import logging
from collections import Counter
from typing import Any

import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

YOUTUBE_API_BASE_URL = "https://www.googleapis.com/youtube/v3"
DEFAULT_TOPICS = ("news", "geopolitics")
DEFAULT_REGIONS = ("US", "IN")
DEFAULT_LIMIT = 10
MAX_RESULTS_PER_REGION = 25
REQUEST_TIMEOUT_SECONDS = 6
STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "has",
    "in",
    "into",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "their",
    "this",
    "to",
    "with",
}


class YouTubeServiceError(Exception):
    """Base error for YouTube service failures."""


class YouTubeConfigError(YouTubeServiceError):
    """Raised when required YouTube configuration is missing."""


class YouTubeAPIError(YouTubeServiceError):
    """Raised when the YouTube API returns an error response."""


def _get_api_key() -> str:
    api_key = os.getenv("YOUTUBE_API_KEY")
    if not api_key:
        raise YouTubeConfigError("Missing required environment variable: YOUTUBE_API_KEY")
    return api_key


def _normalize_regions(regions: tuple[str, ...] | None) -> tuple[str, ...]:
    selected = regions or DEFAULT_REGIONS
    normalized = tuple(region.strip().upper() for region in selected if region.strip())
    return normalized or DEFAULT_REGIONS


def _normalize_topics(topics: tuple[str, ...] | None) -> tuple[str, ...]:
    selected = topics or DEFAULT_TOPICS
    normalized = tuple(topic.strip().lower() for topic in selected if topic.strip())
    return normalized or DEFAULT_TOPICS


def _infer_topic(title: str, fallback_topics: tuple[str, ...]) -> str:
    lower_title = title.lower()
    for topic in fallback_topics:
        if topic in lower_title:
            return topic.title()

    words = [
        token.strip(".,:;!?()[]{}\"'").lower()
        for token in title.split()
        if token.strip(".,:;!?()[]{}\"'")
    ]
    candidates = [
        word for word in words if len(word) > 3 and word not in STOP_WORDS and not word.isdigit()
    ]
    if not candidates:
        return fallback_topics[0].title()

    topic, _ = Counter(candidates).most_common(1)[0]
    return topic.title()


def _matches_topics(title: str, description: str, topics: tuple[str, ...]) -> bool:
    haystack = f"{title} {description}".lower()
    return any(topic in haystack for topic in topics)


def _youtube_get(path: str, *, params: dict[str, Any]) -> dict[str, Any]:
    url = f"{YOUTUBE_API_BASE_URL}/{path}"
    response = requests.get(url, params=params, timeout=REQUEST_TIMEOUT_SECONDS)

    try:
        response.raise_for_status()
    except requests.HTTPError as exc:
        detail = response.text.strip()
        raise YouTubeAPIError(f"YouTube API request failed: {response.status_code} {detail}") from exc

    try:
        return response.json()
    except ValueError as exc:
        raise YouTubeAPIError("YouTube API returned invalid JSON") from exc


def _fetch_region_videos(api_key: str, region: str) -> list[dict[str, Any]]:
    payload = _youtube_get(
        "videos",
        params={
            "part": "snippet,statistics",
            "chart": "mostPopular",
            "videoCategoryId": "25",
            "regionCode": region,
            "maxResults": MAX_RESULTS_PER_REGION,
            "key": api_key,
        },
    )
    return payload.get("items", [])


def _normalize_item(
    item: dict[str, Any],
    *,
    region: str,
    topics: tuple[str, ...],
) -> dict[str, Any] | None:
    video_id = item.get("id")
    snippet = item.get("snippet", {})
    stats = item.get("statistics", {})

    if not video_id:
        return None

    title = (snippet.get("title") or "").strip()
    description = snippet.get("description", "") or ""
    if topics and not _matches_topics(title, description, topics):
        return None

    view_count = int(stats.get("viewCount", 0) or 0)
    like_count = int(stats.get("likeCount", 0) or 0)
    comment_count = int(stats.get("commentCount", 0) or 0)

    if like_count == 0 and view_count:
        like_count = max(1, view_count // 40)
    if comment_count == 0 and view_count:
        comment_count = max(1, view_count // 120)

    return {
        "keyword": _infer_topic(title, topics),
        "title": title,
        "platform": "YouTube",
        "country": region,
        "mentions": view_count,
        "engagement": like_count + comment_count,
        "created_at": snippet.get("publishedAt", ""),
        "source_url": f"https://www.youtube.com/watch?v={video_id}",
        "channel": snippet.get("channelTitle", ""),
    }


def fetch_youtube_trends(
    *,
    regions: tuple[str, ...] | None = None,
    topics: tuple[str, ...] | None = None,
    limit: int = DEFAULT_LIMIT,
) -> list[dict[str, Any]]:
    """
    Fetch trending videos from YouTube API.
    
    Always returns a valid list (possibly empty) even if API calls fail.
    Never raises exceptions; logs failures instead.
    """
    try:
        api_key = _get_api_key()
    except YouTubeConfigError as exc:
        logger.warning("[YOUTUBE] Missing API key: %s", exc)
        return []
    except Exception as exc:
        logger.error("[YOUTUBE] Unexpected error getting API key: %s", exc)
        return []

    selected_regions = _normalize_regions(regions)
    selected_topics = _normalize_topics(topics)
    requested_limit = max(1, min(limit, 25))

    trends: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    failed_regions = []

    for region in selected_regions:
        try:
            items = _fetch_region_videos(api_key, region)
            
            for item in items:
                try:
                    normalized = _normalize_item(item, region=region, topics=selected_topics)
                    if not normalized:
                        continue
                    if normalized["source_url"] in seen_urls:
                        continue
                    seen_urls.add(normalized["source_url"])
                    trends.append(normalized)
                except Exception as exc:
                    logger.debug("[YOUTUBE] Failed to normalize item for %s: %s", region, exc)
                    continue
                    
        except (requests.RequestException, YouTubeAPIError) as exc:
            failed_regions.append(region)
            logger.warning(
                "[YOUTUBE] Failed to fetch %s (timeout=%ds): %s",
                region,
                REQUEST_TIMEOUT_SECONDS,
                exc
            )
            continue
        except Exception as exc:
            failed_regions.append(region)
            logger.error("[YOUTUBE] Unexpected error fetching %s: %s", region, exc)
            continue

    if failed_regions:
        logger.warning(
            "[YOUTUBE] Recovered from %d/%d region(s) (%s); returning %d trend(s)",
            len(failed_regions),
            len(selected_regions),
            ", ".join(failed_regions),
            len(trends)
        )

    trends.sort(
        key=lambda item: (
            item["engagement"],
            item["mentions"],
            item["created_at"],
        ),
        reverse=True,
    )

    return trends[:requested_limit]
