from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import os
from typing import Any, Protocol

import models
import requests
from app.services.live_trends_service import fetch_live_trends
from app.services.region_intelligence_service import map_country_to_region, normalize_country
from sqlalchemy.orm import Session

DEFAULT_DAYS = 7
MAX_DAYS = 30

_POSITIVE_TOKENS = {
    "growth",
    "win",
    "peace",
    "breakthrough",
    "success",
    "recovery",
    "improve",
    "launch",
    "deal",
    "ceasefire",
}
_NEGATIVE_TOKENS = {
    "war",
    "attack",
    "crash",
    "flood",
    "earthquake",
    "fire",
    "virus",
    "outbreak",
    "crisis",
    "conflict",
    "sanction",
    "protest",
}
_RISK_TOKENS = {
    "war",
    "attack",
    "explosion",
    "evacuation",
    "disaster",
    "flood",
    "earthquake",
    "fire",
    "outbreak",
    "crash",
    "terror",
    "ceasefire",
}


@dataclass
class AnalystRequest:
    query: str
    region: str = "Global"
    days: int = DEFAULT_DAYS


class SummaryGenerator(Protocol):
    def generate(
        self,
        *,
        req: AnalystRequest,
        trends: list[dict[str, Any]],
        top_topics: list[dict[str, Any]],
        top_regions: list[dict[str, Any]],
        top_platforms: list[dict[str, Any]],
        sentiment: str,
        risk_level: str,
    ) -> str:
        ...


class RuleBasedSummaryGenerator:
    def generate(
        self,
        *,
        req: AnalystRequest,
        trends: list[dict[str, Any]],
        top_topics: list[dict[str, Any]],
        top_regions: list[dict[str, Any]],
        top_platforms: list[dict[str, Any]],
        sentiment: str,
        risk_level: str,
    ) -> str:
        total_mentions = sum(int(item.get("mentions", 0) or 0) for item in trends)
        total_engagement = sum(int(item.get("engagement", 0) or 0) for item in trends)

        if not trends:
            return (
                f"No meaningful trend evidence was found for '{req.query or 'the current query'}' "
                f"in {req.region} across the last {req.days} day(s)."
            )

        top_topic = top_topics[0]["name"] if top_topics else "general activity"
        top_region = top_regions[0]["name"] if top_regions else req.region
        top_platform = top_platforms[0]["name"] if top_platforms else "cross-platform"

        return (
            f"Across the last {req.days} day(s), '{req.query or 'current trends'}' shows strongest momentum "
            f"around {top_topic}. Activity is concentrated in {top_region} and amplified most on {top_platform}. "
            f"Observed sentiment is {sentiment.lower()} with a {risk_level.lower()} operational risk profile. "
            f"Estimated signal volume: {total_mentions:,} mentions and {total_engagement:,} engagement events."
        )


class OpenAISummaryGenerator:
    def __init__(self, api_key: str, model: str) -> None:
        self._api_key = api_key
        self._model = model

    def generate(
        self,
        *,
        req: AnalystRequest,
        trends: list[dict[str, Any]],
        top_topics: list[dict[str, Any]],
        top_regions: list[dict[str, Any]],
        top_platforms: list[dict[str, Any]],
        sentiment: str,
        risk_level: str,
    ) -> str:
        # This adapter is intentionally isolated so future LLM upgrades can be done
        # without changing route or UI contracts.
        payload = {
            "model": self._model,
            "input": [
                {
                    "role": "system",
                    "content": "You are a geopolitical and social trend analyst. Return one concise paragraph.",
                },
                {
                    "role": "user",
                    "content": (
                        "Query: {query}\n"
                        "Region: {region}\n"
                        "Days: {days}\n"
                        "Top topics: {topics}\n"
                        "Top regions: {regions}\n"
                        "Top platforms: {platforms}\n"
                        "Sentiment: {sentiment}\n"
                        "Risk level: {risk}\n"
                        "Generate a concise executive summary."
                    ).format(
                        query=req.query or "current trends",
                        region=req.region,
                        days=req.days,
                        topics=", ".join(item["name"] for item in top_topics[:5]) or "None",
                        regions=", ".join(item["name"] for item in top_regions[:5]) or "None",
                        platforms=", ".join(item["name"] for item in top_platforms[:5]) or "None",
                        sentiment=sentiment,
                        risk=risk_level,
                    ),
                },
            ],
        }

        response = requests.post(
            "https://api.openai.com/v1/responses",
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=12,
        )
        response.raise_for_status()

        data = response.json()
        output_text = str(data.get("output_text", "")).strip()
        if output_text:
            return output_text

        output_items = data.get("output", [])
        for item in output_items:
            for content in item.get("content", []):
                text = str(content.get("text", "")).strip()
                if text:
                    return text

        raise ValueError("OpenAI response did not include summary text")


def _select_summary_generator() -> SummaryGenerator:
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    openai_model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini").strip() or "gpt-4.1-mini"

    if openai_key:
        return OpenAISummaryGenerator(api_key=openai_key, model=openai_model)

    return RuleBasedSummaryGenerator()


def _normalize_region(region: str | None) -> str:
    value = str(region or "Global").strip()
    return value or "Global"


def _sanitize_days(days: int | None) -> int:
    if not isinstance(days, int):
        return DEFAULT_DAYS
    if days < 1:
        return 1
    if days > MAX_DAYS:
        return MAX_DAYS
    return days


def _load_historical_trends(db: Session, days: int) -> list[dict[str, Any]]:
    since_dt = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        db.query(models.HistoricalTrend)
        .filter(models.HistoricalTrend.snapshot_time >= since_dt)
        .all()
    )

    return [
        {
            "keyword": row.keyword or "Signal",
            "title": row.title or "Untitled trend",
            "platform": row.platform or "Unknown",
            "country": normalize_country(row.country),
            "mentions": int(row.mentions or 0),
            "engagement": int(row.engagement or 0),
            "score": float(row.score or 0.0),
            "created_at": row.created_at.isoformat() if row.created_at else "",
            "source": "historical",
        }
        for row in rows
    ]


def _load_live_trends() -> list[dict[str, Any]]:
    items = fetch_live_trends()
    return [
        {
            "keyword": str(item.get("keyword", "Signal") or "Signal"),
            "title": str(item.get("title", "Untitled trend") or "Untitled trend"),
            "platform": str(item.get("platform", "Unknown") or "Unknown"),
            "country": normalize_country(item.get("country", "Global")),
            "mentions": int(item.get("mentions", 0) or 0),
            "engagement": int(item.get("engagement", 0) or 0),
            "score": float(item.get("score", 0.0) or 0.0),
            "created_at": str(item.get("created_at", "") or ""),
            "source": "live",
        }
        for item in items
    ]


def _matches_region(item: dict[str, Any], selected_region: str) -> bool:
    normalized_region = selected_region.lower()
    if normalized_region in {"global", "world", "all", "worldwide"}:
        return True

    item_region = map_country_to_region(item.get("country", "Global")).lower()
    item_country = normalize_country(item.get("country", "Global")).lower()
    return item_region == normalized_region or item_country == normalized_region


def _matches_query(item: dict[str, Any], query: str) -> bool:
    q = query.strip().lower()
    if not q:
        return True

    haystack = f"{item.get('keyword', '')} {item.get('title', '')}".lower()
    if q in haystack:
        return True

    tokens = [token for token in q.split() if token]
    if not tokens:
        return True
    return all(token in haystack for token in tokens)


def _build_top_topics(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, float]] = defaultdict(lambda: {"count": 0.0, "momentum": 0.0})

    for item in items:
        topic = str(item.get("keyword", "Signal") or "Signal").strip() or "Signal"
        key = topic.lower()
        grouped[key]["count"] += 1
        grouped[key]["momentum"] += (
            float(item.get("score", 0.0) or 0.0)
            + (int(item.get("mentions", 0) or 0) * 0.001)
            + (int(item.get("engagement", 0) or 0) * 0.0005)
        )

    ranked = sorted(grouped.items(), key=lambda pair: pair[1]["momentum"], reverse=True)
    return [
        {
            "name": topic,
            "count": int(round(meta["count"])),
            "momentum": round(float(meta["momentum"]), 2),
        }
        for topic, meta in ranked[:8]
    ]


def _build_top_regions(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    counter = Counter(map_country_to_region(item.get("country", "Global")) for item in items)
    return [{"name": name, "count": count} for name, count in counter.most_common(8)]


def _build_top_platforms(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    counter = Counter(str(item.get("platform", "Unknown") or "Unknown") for item in items)
    return [{"name": name, "count": count} for name, count in counter.most_common(8)]


def _infer_sentiment(items: list[dict[str, Any]]) -> str:
    if not items:
        return "Mixed"

    positive_hits = 0
    negative_hits = 0

    for item in items:
        weight = max(1, int(item.get("mentions", 0) or 0) // 15000)
        text = f"{item.get('keyword', '')} {item.get('title', '')}".lower()
        positive_hits += sum(weight for token in _POSITIVE_TOKENS if token in text)
        negative_hits += sum(weight for token in _NEGATIVE_TOKENS if token in text)

    if positive_hits > negative_hits * 1.25:
        return "Positive"
    if negative_hits > positive_hits * 1.25:
        return "Negative"
    return "Mixed"


def _infer_risk_level(items: list[dict[str, Any]]) -> str:
    if not items:
        return "Low"

    risk_points = 0.0
    for item in items:
        mentions = int(item.get("mentions", 0) or 0)
        engagement = int(item.get("engagement", 0) or 0)
        text = f"{item.get('keyword', '')} {item.get('title', '')}".lower()

        if any(token in text for token in _RISK_TOKENS):
            risk_points += 3.0
        if mentions >= 250_000:
            risk_points += 2.0
        if engagement >= 300_000:
            risk_points += 2.0
        if map_country_to_region(item.get("country", "Global")) == "Global":
            risk_points += 0.25

    average_risk = risk_points / max(len(items), 1)
    if average_risk >= 3.0:
        return "High"
    if average_risk >= 1.25:
        return "Medium"
    return "Low"


def _compare_regions_analysis(combined: list[dict[str, Any]]) -> str:
    """Compare trends across different regions."""
    if not combined:
        return "Insufficient regional data to perform comparison."
    
    region_data: dict[str, dict[str, Any]] = defaultdict(lambda: {
        "mentions": 0,
        "engagement": 0,
        "trends": [],
        "score": 0.0,
        "count": 0
    })
    
    for item in combined:
        region = map_country_to_region(item.get("country", "Global"))
        region_data[region]["mentions"] += int(item.get("mentions", 0) or 0)
        region_data[region]["engagement"] += int(item.get("engagement", 0) or 0)
        region_data[region]["score"] += float(item.get("score", 0.0) or 0.0)
        region_data[region]["count"] += 1
        region_data[region]["trends"].append(item.get("keyword", "Signal"))
    
    # Calculate average scores and sort by engagement
    ranked_regions = []
    for region, data in region_data.items():
        avg_score = data["score"] / max(data["count"], 1)
        ranked_regions.append({
            "name": region,
            "mentions": data["mentions"],
            "engagement": data["engagement"],
            "avg_score": round(avg_score, 2),
            "trend_count": data["count"],
        })
    
    ranked_regions.sort(key=lambda x: x["engagement"], reverse=True)
    
    top_regions = ranked_regions[:3]
    comparison = "\n".join([
        f"  • {r['name']}: {r['engagement']:,} engagement, {r['mentions']:,} mentions, Score: {r['avg_score']}"
        for r in top_regions
    ])
    
    return f"Regional Comparison (Top 3):\n{comparison}"


def _forecast_trends_analysis(combined: list[dict[str, Any]]) -> str:
    """Forecast emerging trend trajectories."""
    if not combined:
        return "Insufficient historical data for trend forecasting."
    
    # Score calculation: higher score + high engagement = strong trend
    high_momentum = [item for item in combined if float(item.get("score", 0) or 0) >= 70.0]
    growing_trends = sorted(
        combined,
        key=lambda x: (int(x.get("engagement", 0) or 0), float(x.get("score", 0) or 0)),
        reverse=True
    )[:5]
    
    if not high_momentum:
        return "Current trends show stable trajectory with moderate growth expected."
    
    forecast_items = "\n".join([
        f"  • {item.get('keyword', 'Signal')}: Score {float(item.get('score', 0) or 0):.1f}, "
        f"Engagement {int(item.get('engagement', 0) or 0):,}"
        for item in growing_trends[:3]
    ])
    
    momentum_level = "High" if len(high_momentum) > len(combined) * 0.3 else "Moderate"
    return f"Trend Forecast (Next 7 days) - {momentum_level} momentum:\n{forecast_items}"


def _risk_detection_analysis(combined: list[dict[str, Any]]) -> str:
    """Detect and analyze potential risk factors."""
    if not combined:
        return "No risk indicators detected."
    
    critical_risks = []
    high_risks = []
    medium_risks = []
    
    for item in combined:
        text = f"{item.get('keyword', '')} {item.get('title', '')}".lower()
        mentions = int(item.get("mentions", 0) or 0)
        engagement = int(item.get("engagement", 0) or 0)
        score = float(item.get("score", 0) or 0)
        
        # Critical risk: Known risk terms + high engagement
        if any(token in text for token in _RISK_TOKENS):
            if engagement > 300_000:
                critical_risks.append({
                    "keyword": item.get("keyword", "Signal"),
                    "severity": "Critical",
                    "engagement": engagement,
                })
            elif engagement > 100_000:
                high_risks.append({
                    "keyword": item.get("keyword", "Signal"),
                    "severity": "High",
                    "engagement": engagement,
                })
            else:
                medium_risks.append({
                    "keyword": item.get("keyword", "Signal"),
                    "severity": "Medium",
                    "engagement": engagement,
                })
    
    risk_summary = ""
    if critical_risks:
        risk_summary += f"🔴 CRITICAL ({len(critical_risks)}): " + ", ".join([r["keyword"] for r in critical_risks[:2]]) + "\n"
    if high_risks:
        risk_summary += f"🟠 HIGH ({len(high_risks)}): " + ", ".join([r["keyword"] for r in high_risks[:2]]) + "\n"
    if medium_risks:
        risk_summary += f"🟡 MEDIUM ({len(medium_risks)}): " + ", ".join([r["keyword"] for r in medium_risks[:2]]) + "\n"
    
    return risk_summary or "Risk Level: Low - No critical indicators detected."


def _viral_opportunity_analysis(combined: list[dict[str, Any]]) -> str:
    """Identify viral content opportunities."""
    if not combined:
        return "Insufficient data for opportunity analysis."
    
    # Opportunities: High engagement + high mentions + positive sentiment
    opportunities = []
    for item in combined:
        mentions = int(item.get("mentions", 0) or 0)
        engagement = int(item.get("engagement", 0) or 0)
        score = float(item.get("score", 0) or 0)
        text = f"{item.get('keyword', '')} {item.get('title', '')}".lower()
        
        # Calculate virality index (mentions * engagement * score)
        virality_score = (mentions * engagement * score) / 1_000_000_000  # normalize
        
        # Positive content or neutral high-engagement = opportunity
        has_positive = any(token in text for token in _POSITIVE_TOKENS)
        no_risk = not any(token in text for token in _RISK_TOKENS)
        
        if (virality_score > 50 or (engagement > 200_000 and mentions > 150_000)) and (has_positive or no_risk):
            opportunities.append({
                "keyword": item.get("keyword", "Signal"),
                "platform": item.get("platform", "Unknown"),
                "engagement": engagement,
                "virality": round(virality_score, 2),
                "has_momentum": score > 60,
            })
    
    if not opportunities:
        return "No immediate viral opportunities identified. Monitor emerging categories for next 24h."
    
    # Sort by virality score
    opportunities.sort(key=lambda x: x["virality"], reverse=True)
    
    top_opps = "\n".join([
        f"  • {opp['keyword']} ({opp['platform']}): Virality Index {opp['virality']:.1f}, "
        f"Engagement {opp['engagement']:,}" + (" ✓ High Momentum" if opp["has_momentum"] else "")
        for opp in opportunities[:3]
    ])
    
    return f"Viral Opportunities (Top 3):\n{top_opps}"


def generate_ai_summary(db: Session, query: str, region: str, days: int, mode: str = "summary") -> dict[str, Any]:
    req = AnalystRequest(
        query=str(query or "").strip(),
        region=_normalize_region(region),
        days=_sanitize_days(days),
    )

    live_items = _load_live_trends()
    historical_items = _load_historical_trends(db=db, days=req.days)

    combined = live_items + historical_items
    combined = [item for item in combined if _matches_region(item, req.region)]
    combined = [item for item in combined if _matches_query(item, req.query)]

    combined.sort(
        key=lambda item: (
            float(item.get("score", 0.0) or 0.0),
            int(item.get("engagement", 0) or 0),
            int(item.get("mentions", 0) or 0),
        ),
        reverse=True,
    )

    top_topics = _build_top_topics(combined)
    top_regions = _build_top_regions(combined)
    top_platforms = _build_top_platforms(combined)
    sentiment = _infer_sentiment(combined)
    risk_level = _infer_risk_level(combined)

    # Generate analysis based on mode
    if mode == "compare_regions":
        summary = _compare_regions_analysis(combined)
    elif mode == "forecast":
        summary = _forecast_trends_analysis(combined)
    elif mode == "risk_detection":
        summary = _risk_detection_analysis(combined)
    elif mode == "viral_opportunity":
        summary = _viral_opportunity_analysis(combined)
    else:  # Default: summary
        generator = _select_summary_generator()
        try:
            summary = generator.generate(
                req=req,
                trends=combined,
                top_topics=top_topics,
                top_regions=top_regions,
                top_platforms=top_platforms,
                sentiment=sentiment,
                risk_level=risk_level,
            )
        except Exception:
            summary = RuleBasedSummaryGenerator().generate(
                req=req,
                trends=combined,
                top_topics=top_topics,
                top_regions=top_regions,
                top_platforms=top_platforms,
                sentiment=sentiment,
                risk_level=risk_level,
            )

    return {
        "summary": summary,
        "mode": mode,
        "top_topics": top_topics,
        "top_regions": top_regions,
        "top_platforms": top_platforms,
        "sentiment": sentiment,
        "risk_level": risk_level,
    }
