import logging
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from email.utils import parsedate_to_datetime
from typing import Any
from urllib import parse, request

import feedparser

RSS_FEEDS = {
    "worldnews": "https://www.reddit.com/r/worldnews/.rss",
    "news": "https://www.reddit.com/r/news/.rss",
    "politics": "https://www.reddit.com/r/politics/.rss",
    "geopolitics": "https://www.reddit.com/r/geopolitics/.rss",
}

REQUEST_TIMEOUT_SECONDS = 5
MAX_ITEMS_PER_FEED = 12
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

logger = logging.getLogger(__name__)


def _infer_keyword(title: str, subreddit: str) -> str:
    words = [
        token.strip(".,:;!?()[]{}\"'").lower()
        for token in title.split()
        if token.strip(".,:;!?()[]{}\"'")
    ]
    candidates = [
        word for word in words if len(word) > 3 and word not in STOP_WORDS and not word.isdigit()
    ]

    if not candidates:
        return subreddit.title()

    keyword, _ = Counter(candidates).most_common(1)[0]
    return keyword.title()


def _estimate_mentions(entry: dict[str, Any], title: str) -> int:
    base = max(8, len(title.split()) * 3)
    tags = len(entry.get("tags", [])) * 4
    return base + tags


def _estimate_engagement(entry: dict[str, Any], title: str) -> int:
    summary = entry.get("summary", "") or ""
    content_bonus = min(len(summary) // 20, 120)
    return _estimate_mentions(entry, title) * 2 + content_bonus


def _parse_published_at(entry: dict[str, Any]) -> str:
    published = entry.get("published") or entry.get("updated")
    if not published:
        return ""

    try:
        return parsedate_to_datetime(published).isoformat()
    except (TypeError, ValueError, IndexError):
        return ""


def _fetch_feed(url: str) -> feedparser.FeedParserDict:
    req = request.Request(
        url,
        headers={
            "User-Agent": "SocialRadar/1.0 (+https://socialradar.local)",
            "Accept": "application/rss+xml, application/xml, text/xml",
        },
    )

    with request.urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as response:
        content = response.read()

    parsed = feedparser.parse(content)
    if parsed.bozo and not parsed.entries:
        raise ValueError(f"Invalid RSS feed returned from {url}")

    return parsed


def _normalize_entry(entry: dict[str, Any], subreddit: str, query: str | None = None) -> dict[str, Any]:
    title = (entry.get("title") or "").strip()
    created_at = _parse_published_at(entry)
    source_url = entry.get("link", "")
    mentions = _estimate_mentions(entry, title)
    engagement = _estimate_engagement(entry, title)

    return {
        "keyword": query or _infer_keyword(title, subreddit),
        "title": title,
        "platform": "Reddit",
        "country": "Global",
        "mentions": mentions,
        "engagement": engagement,
        "created_at": created_at,
        "source_url": source_url,
        "subreddit": subreddit,
    }


def _matches_query(entry: dict[str, Any], query: str) -> bool:
    if not query:
        return True

    normalized = query.strip().lower().lstrip("#")
    haystack = f"{entry.get('title', '')} {entry.get('summary', '')}".lower()
    return normalized in haystack


def fetch_reddit_rss_trends(query: str | None = None) -> list[dict[str, Any]]:
    """
    Fetch trending posts from Reddit RSS feeds.
    
    Always returns a valid list (possibly empty) even if feeds fail.
    Never raises exceptions; logs failures instead.
    """
    trends: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    total_errors = 0
    normalized_query = (query or "").strip()

    feeds = RSS_FEEDS
    if normalized_query:
        quoted_query = parse.quote(normalized_query.lstrip("#"))
        feeds = {
            "reddit-search": (
                "https://www.reddit.com/search.rss?"
                f"q={quoted_query}&sort=hot&t=week"
            ),
            **RSS_FEEDS,
        }

    with ThreadPoolExecutor(max_workers=min(len(feeds), 5)) as executor:
        future_map = {
            executor.submit(_fetch_feed, url): (subreddit, url)
            for subreddit, url in feeds.items()
        }

        for future in as_completed(future_map):
            subreddit, _url = future_map[future]
            try:
                parsed = future.result()
                
                for entry in parsed.entries[:MAX_ITEMS_PER_FEED]:
                    try:
                        if normalized_query and not _matches_query(entry, normalized_query):
                            continue
                        normalized = _normalize_entry(
                            entry,
                            subreddit,
                            normalized_query if normalized_query.startswith("#") else normalized_query.title() or None,
                        )
                        source_url = normalized["source_url"]
                        if not source_url or source_url in seen_urls:
                            continue
                        seen_urls.add(source_url)
                        trends.append(normalized)
                    except Exception as exc:
                        logger.debug("Failed to normalize Reddit entry from r/%s: %s", subreddit, exc)
                        continue
                        
            except Exception as exc:
                total_errors += 1
                logger.warning(
                    "[REDDIT] Failed to fetch RSS for r/%s (timeout=%ds): %s",
                    subreddit,
                    REQUEST_TIMEOUT_SECONDS,
                    exc
                )
                continue

    if total_errors > 0:
        logger.warning(
            "[REDDIT] Recovered from %d/%d feed(s); returning %d trend(s)",
            total_errors,
            len(RSS_FEEDS),
            len(trends)
        )

    trends.sort(
        key=lambda item: (
            bool(item["created_at"]),
            item["created_at"],
            item["engagement"],
            item["mentions"],
        ),
        reverse=True,
    )
    return trends
