"""
Reddit service — fetches trending posts via the official Reddit API.

Uses PRAW (Python Reddit API Wrapper) which handles OAuth, rate-limiting,
and token refresh automatically.

Required env vars (set in .env):
  REDDIT_CLIENT_ID      — app client id from reddit.com/prefs/apps
  REDDIT_CLIENT_SECRET  — app secret from reddit.com/prefs/apps
  REDDIT_USER_AGENT     — e.g.  SocialRadar/1.0 by YourUsername
"""

import os
from collections import Counter
from datetime import datetime, timezone
from typing import Any

import praw
from dotenv import load_dotenv

load_dotenv()

DEFAULT_SUBREDDITS = ("worldnews", "news", "politics", "geopolitics")
DEFAULT_LIMIT = 10

SUBREDDIT_COUNTRY_MAP: dict[str, str] = {
    "politics": "USA",
    "news": "Global",
    "worldnews": "Global",
    "geopolitics": "Global",
}

STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
    "has", "have", "he", "her", "his", "how", "if", "in", "is", "it",
    "its", "of", "on", "or", "our", "she", "that", "the", "their",
    "they", "this", "to", "was", "we", "were", "who", "will", "with",
    "you", "your",
}


# ── Custom exceptions ──────────────────────────────────────────────────────────

class RedditServiceError(Exception):
    """Base error for Reddit integration."""


class RedditConfigError(RedditServiceError):
    """Raised when required Reddit credentials are missing or invalid."""


class RedditAPIError(RedditServiceError):
    """Raised when the Reddit API returns an unexpected response."""


# ── Helpers ────────────────────────────────────────────────────────────────────

def _get_required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value or value.startswith("your_"):
        raise RedditConfigError(
            f"Missing Reddit credential: '{name}'. "
            "Please fill in your .env file — see comments inside it for instructions."
        )
    return value


def _build_reddit_client() -> praw.Reddit:
    """Authenticate with Reddit using read-only app credentials."""
    client_id = _get_required_env("REDDIT_CLIENT_ID")
    client_secret = _get_required_env("REDDIT_CLIENT_SECRET")
    user_agent = _get_required_env("REDDIT_USER_AGENT")

    return praw.Reddit(
        client_id=client_id,
        client_secret=client_secret,
        user_agent=user_agent,
    )


def _extract_keyword(title: str, subreddit: str) -> str:
    """Pick the most significant word from a post title as a keyword label."""
    tokens = title.split()
    words = [
        t.strip(".,:;!?()[]{}\"'").lower()
        for t in tokens
        if t.strip(".,:;!?()[]{}\"'")
    ]
    significant = [
        w for w in words
        if len(w) > 3 and w not in STOP_WORDS and not w.isdigit()
    ]
    if not significant:
        return subreddit.title()
    top_word, _ = Counter(significant).most_common(1)[0]
    return top_word.title()


def _normalize_post(submission: Any, subreddit_name: str) -> dict[str, Any]:
    """Convert a PRAW Submission into the Social Radar trend schema."""
    title: str = (submission.title or "").strip()
    score: int = int(submission.score or 0)
    comments: int = int(submission.num_comments or 0)
    created_utc: float = float(submission.created_utc or 0)
    permalink: str = submission.permalink or ""

    created_at = datetime.fromtimestamp(created_utc, tz=timezone.utc).isoformat()
    source_url = (
        f"https://www.reddit.com{permalink}" if permalink else "https://www.reddit.com"
    )

    return {
        "keyword": _extract_keyword(title, subreddit_name),
        "title": title,
        "platform": "Reddit",
        "country": SUBREDDIT_COUNTRY_MAP.get(subreddit_name, "Global"),
        "mentions": comments,
        "engagement": score + comments,
        "created_at": created_at,
        "source_url": source_url,
    }


# ── Public API ─────────────────────────────────────────────────────────────────

def fetch_reddit_trends(
    *,
    subreddits: tuple[str, ...] = DEFAULT_SUBREDDITS,
    per_listing_limit: int = DEFAULT_LIMIT,
) -> list[dict[str, Any]]:
    """
    Fetch trending posts from one or more subreddits.

    Returns a deduplicated, engagement-sorted list of trend objects.

    Raises:
        RedditConfigError: if env vars are missing / still placeholder values.
        RedditAPIError:    if the Reddit API call fails.
    """
    try:
        reddit = _build_reddit_client()
    except RedditConfigError:
        raise
    except Exception as exc:
        raise RedditConfigError(f"Could not build Reddit client: {exc}") from exc

    trends: list[dict[str, Any]] = []
    seen_urls: set[str] = set()

    for subreddit_name in subreddits:
        subreddit = reddit.subreddit(subreddit_name)

        for listing_fn_name in ("hot", "rising"):
            try:
                listing_fn = getattr(subreddit, listing_fn_name)
                submissions = list(listing_fn(limit=per_listing_limit))
            except Exception as exc:
                # Surface as a proper API error so FastAPI returns 502
                raise RedditAPIError(
                    f"Failed to fetch r/{subreddit_name}/{listing_fn_name}: {exc}"
                ) from exc

            for submission in submissions:
                try:
                    normalized = _normalize_post(submission, subreddit_name)
                except Exception:
                    # Skip malformed posts silently
                    continue

                if normalized["source_url"] in seen_urls:
                    continue
                seen_urls.add(normalized["source_url"])
                trends.append(normalized)

    # Sort by engagement DESC, then mention count, then recency
    trends.sort(
        key=lambda item: (item["engagement"], item["mentions"], item["created_at"]),
        reverse=True,
    )
    return trends
