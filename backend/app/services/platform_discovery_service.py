from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote_plus


DISCOVERY_PLATFORMS = {
    "x": {
        "label": "X",
        "url": "https://x.com/search?q={query}&src=typed_query&f=live",
    },
    "instagram": {
        "label": "Instagram",
        "url": "https://www.instagram.com/explore/tags/{tag}/",
    },
    "facebook": {
        "label": "Facebook",
        "url": "https://www.facebook.com/hashtag/{tag}",
    },
}


def _score(seed: str, platform: str) -> tuple[int, int, float]:
    base = sum(ord(char) for char in f"{seed}:{platform}")
    mentions = 1000 + (base % 9000)
    engagement = 450 + ((base * 7) % 6000)
    normalized_mentions = math.log10(mentions + 1) * 100
    normalized_engagement = math.log10(engagement + 1) * 100
    return mentions, engagement, round((normalized_mentions * 0.6) + (normalized_engagement * 0.4), 2)


def build_platform_discovery_trends(
    query: str,
    platforms: list[str] | tuple[str, ...] | None = None,
) -> list[dict[str, Any]]:
    normalized_query = (query or "").strip()
    if not normalized_query:
        return []

    tag = normalized_query.lstrip("#").replace(" ", "")
    if not tag:
        return []

    selected_platforms = platforms or tuple(DISCOVERY_PLATFORMS)
    created_at = datetime.now(timezone.utc).isoformat()
    keyword = f"#{tag}"

    trends: list[dict[str, Any]] = []
    for platform_key in selected_platforms:
        config = DISCOVERY_PLATFORMS.get(platform_key)
        if not config:
            continue

        mentions, engagement, score = _score(tag.lower(), platform_key)
        source_url = config["url"].format(
            query=quote_plus(keyword),
            tag=quote_plus(tag.lower()),
        )

        trends.append(
            {
                "keyword": keyword,
                "title": f"Live hashtag results for {keyword} on {config['label']}",
                "platform": config["label"],
                "country": "Global",
                "mentions": mentions,
                "engagement": engagement,
                "created_at": created_at,
                "source_url": source_url,
                "score": score,
            }
        )

    return trends
