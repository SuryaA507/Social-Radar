from datetime import date, datetime, timedelta
import logging
import json

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.security import HTTPBearer
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
import csv
import io
from fpdf import FPDF
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

import models
from app.services.ai_analyst_service import generate_ai_summary
from app.services.auth_service import (
    authenticate_user,
    create_user,
    create_access_token,
    verify_token,
    get_user_by_email,
    get_user_by_username,
    get_user_by_id,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)
from app.services.watchlist_service import (
    create_saved_search,
    get_user_saved_searches,
    delete_saved_search,
    create_tracked_topic,
    get_user_tracked_topics,
    update_tracked_topic,
    delete_tracked_topic,
    create_saved_region,
    get_user_saved_regions,
    delete_saved_region,
    create_custom_alert,
    get_user_custom_alerts,
    update_custom_alert,
    delete_custom_alert,
)
from app.services.live_trends_service import fetch_live_trends
from app.services.map_intelligence_service import (
    build_location_intelligence,
    build_map_hotspots,
)
from app.services.reddit_rss_service import fetch_reddit_rss_trends
from app.services.region_intelligence_service import (
    REGION_ORDER,
    get_available_regions,
    get_region_trends,
)
from app.services.search_service import search_events
from app.services.youtube_service import (
    YouTubeAPIError,
    YouTubeConfigError,
    fetch_youtube_trends,
)
from database import engine, get_db
from services.scheduler_service import start_snapshot_scheduler, stop_snapshot_scheduler

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# Create all tables in the database
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Social Radar API")

# Security
security = HTTPBearer()


# Pydantic Models
class AISummaryRequest(BaseModel):
    query: str = Field(default="What is trending globally today?", min_length=1)
    region: str = Field(default="Global")
    days: int = Field(default=7, ge=1, le=30)
    mode: str = Field(default="summary", description="Analysis mode: summary, compare_regions, forecast, risk_detection, viral_opportunity")


# Auth Models
class SignupRequest(BaseModel):
    email: str
    username: str
    password: str
    full_name: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    email: str
    username: str


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    full_name: str | None
    created_at: datetime


# Watchlist Models
class SavedSearchRequest(BaseModel):
    name: str
    query: str
    region: str = "Global"
    days: int = 7


class SavedSearchResponse(BaseModel):
    id: int
    name: str
    query: str
    region: str
    days: int
    created_at: datetime


class TrackedTopicRequest(BaseModel):
    topic: str
    keywords: list[str]


class TrackedTopicResponse(BaseModel):
    id: int
    topic: str
    keywords: list[str]
    is_active: bool
    created_at: datetime


class SavedRegionRequest(BaseModel):
    region: str
    label: str | None = None


class SavedRegionResponse(BaseModel):
    id: int
    region: str
    label: str
    is_active: bool
    created_at: datetime


class CustomAlertRequest(BaseModel):
    name: str
    keywords: list[str]
    regions: list[str]
    alert_type: str = "spike"
    min_engagement: int = 0
    min_mentions: int = 0


class CustomAlertResponse(BaseModel):
    id: int
    name: str
    keywords: list[str]
    regions: list[str]
    alert_type: str
    min_engagement: int
    min_mentions: int
    is_active: bool
    created_at: datetime


# Dependency: Extract user from token
def get_current_user(credentials = Depends(security), db: Session = Depends(get_db)) -> models.User:
    """Extract and verify current user from token."""
    token = credentials.credentials if hasattr(credentials, 'credentials') else credentials
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = get_user_by_id(db, int(user_id))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def _json_error(status_code: int, message: str, *, code: str, details: object | None = None):
    payload: dict[str, object] = {
        "error": {
            "code": code,
            "message": message,
            "status": status_code,
        }
    }
    if details is not None:
        payload["error"] = {**payload["error"], "details": details}
    return JSONResponse(status_code=status_code, content=payload)


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException):
    detail = exc.detail
    if isinstance(detail, dict):
        message = str(detail.get("message", "Request failed"))
    else:
        message = str(detail)
    return _json_error(exc.status_code, message, code="http_error", details=detail)


@app.exception_handler(RequestValidationError)
async def request_validation_handler(_request: Request, exc: RequestValidationError):
    return _json_error(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "Invalid request payload",
        code="validation_error",
        details=exc.errors(),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request: Request, exc: Exception):
    logger.exception("Unhandled server error", exc_info=exc)
    return _json_error(
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        "Internal server error",
        code="internal_error",
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    started = start_snapshot_scheduler()
    if started:
        logger.info("Hourly snapshot scheduler is active")


@app.on_event("shutdown")
def on_shutdown() -> None:
    stop_snapshot_scheduler()


# ============ AUTH ENDPOINTS ============

@app.post("/api/auth/signup")
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    """Register a new user."""
    # Check if user already exists
    if get_user_by_email(db, payload.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    if get_user_by_username(db, payload.username):
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # Create user
    user = create_user(
        db,
        email=payload.email,
        username=payload.username,
        password=payload.password,
        full_name=payload.full_name,
    )
    
    # Create token
    access_token = create_access_token(
        data={"sub": user.id},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    
    return AuthResponse(
        access_token=access_token,
        token_type="bearer",
        user_id=user.id,
        email=user.email,
        username=user.username,
    )


@app.post("/api/auth/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Login user."""
    user = authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = create_access_token(
        data={"sub": user.id},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    
    return AuthResponse(
        access_token=access_token,
        token_type="bearer",
        user_id=user.id,
        email=user.email,
        username=user.username,
    )


@app.get("/api/auth/me")
def get_current_user_profile(current_user: models.User = Depends(get_current_user)) -> UserResponse:
    """Get current user profile."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        full_name=current_user.full_name,
        created_at=current_user.created_at,
    )


# ============ SAVED SEARCHES ENDPOINTS ============

@app.post("/api/watchlist/saved-searches")
def create_search(
    payload: SavedSearchRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SavedSearchResponse:
    """Create a saved search."""
    search = create_saved_search(
        db,
        user_id=current_user.id,
        name=payload.name,
        query=payload.query,
        region=payload.region,
        days=payload.days,
    )
    return SavedSearchResponse(
        id=search.id,
        name=search.name,
        query=search.query,
        region=search.region,
        days=search.days,
        created_at=search.created_at,
    )


@app.get("/api/watchlist/saved-searches")
def list_saved_searches(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SavedSearchResponse]:
    """List all saved searches for current user."""
    searches = get_user_saved_searches(db, current_user.id)
    return [
        SavedSearchResponse(
            id=s.id,
            name=s.name,
            query=s.query,
            region=s.region,
            days=s.days,
            created_at=s.created_at,
        )
        for s in searches
    ]


@app.delete("/api/watchlist/saved-searches/{search_id}")
def remove_saved_search(
    search_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a saved search."""
    if not delete_saved_search(db, search_id, current_user.id):
        raise HTTPException(status_code=404, detail="Search not found")
    return {"deleted": True}


# ============ TRACKED TOPICS ENDPOINTS ============

@app.post("/api/watchlist/tracked-topics")
def track_topic(
    payload: TrackedTopicRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TrackedTopicResponse:
    """Create a tracked topic."""
    topic = create_tracked_topic(
        db,
        user_id=current_user.id,
        topic=payload.topic,
        keywords=payload.keywords,
    )
    return TrackedTopicResponse(
        id=topic.id,
        topic=topic.topic,
        keywords=json.loads(topic.keywords),
        is_active=topic.is_active,
        created_at=topic.created_at,
    )


@app.get("/api/watchlist/tracked-topics")
def list_tracked_topics(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TrackedTopicResponse]:
    """List all tracked topics for current user."""
    topics = get_user_tracked_topics(db, current_user.id)
    return [
        TrackedTopicResponse(
            id=t.id,
            topic=t.topic,
            keywords=json.loads(t.keywords),
            is_active=t.is_active,
            created_at=t.created_at,
        )
        for t in topics
    ]


@app.put("/api/watchlist/tracked-topics/{topic_id}")
def update_topic(
    topic_id: int,
    payload: TrackedTopicRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TrackedTopicResponse:
    """Update a tracked topic."""
    topic = update_tracked_topic(
        db, topic_id, current_user.id, keywords=payload.keywords
    )
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return TrackedTopicResponse(
        id=topic.id,
        topic=topic.topic,
        keywords=json.loads(topic.keywords),
        is_active=topic.is_active,
        created_at=topic.created_at,
    )


@app.delete("/api/watchlist/tracked-topics/{topic_id}")
def remove_tracked_topic(
    topic_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a tracked topic."""
    if not delete_tracked_topic(db, topic_id, current_user.id):
        raise HTTPException(status_code=404, detail="Topic not found")
    return {"deleted": True}


# ============ SAVED REGIONS ENDPOINTS ============

@app.post("/api/watchlist/saved-regions")
def save_region(
    payload: SavedRegionRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SavedRegionResponse:
    """Save a region."""
    region = create_saved_region(
        db, user_id=current_user.id, region=payload.region, label=payload.label
    )
    return SavedRegionResponse(
        id=region.id,
        region=region.region,
        label=region.label,
        is_active=region.is_active,
        created_at=region.created_at,
    )


@app.get("/api/watchlist/saved-regions")
def list_saved_regions(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SavedRegionResponse]:
    """List all saved regions for current user."""
    regions = get_user_saved_regions(db, current_user.id)
    return [
        SavedRegionResponse(
            id=r.id,
            region=r.region,
            label=r.label,
            is_active=r.is_active,
            created_at=r.created_at,
        )
        for r in regions
    ]


@app.delete("/api/watchlist/saved-regions/{region_id}")
def remove_saved_region(
    region_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a saved region."""
    if not delete_saved_region(db, region_id, current_user.id):
        raise HTTPException(status_code=404, detail="Region not found")
    return {"deleted": True}


# ============ CUSTOM ALERTS ENDPOINTS ============

@app.post("/api/watchlist/custom-alerts")
def create_alert(
    payload: CustomAlertRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CustomAlertResponse:
    """Create a custom alert."""
    alert = create_custom_alert(
        db,
        user_id=current_user.id,
        name=payload.name,
        keywords=payload.keywords,
        regions=payload.regions,
        alert_type=payload.alert_type,
        min_engagement=payload.min_engagement,
        min_mentions=payload.min_mentions,
    )
    return CustomAlertResponse(
        id=alert.id,
        name=alert.name,
        keywords=json.loads(alert.keywords),
        regions=json.loads(alert.regions),
        alert_type=alert.alert_type,
        min_engagement=alert.min_engagement,
        min_mentions=alert.min_mentions,
        is_active=alert.is_active,
        created_at=alert.created_at,
    )


@app.get("/api/watchlist/custom-alerts")
def list_custom_alerts(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[CustomAlertResponse]:
    """List all custom alerts for current user."""
    alerts = get_user_custom_alerts(db, current_user.id)
    return [
        CustomAlertResponse(
            id=a.id,
            name=a.name,
            keywords=json.loads(a.keywords),
            regions=json.loads(a.regions),
            alert_type=a.alert_type,
            min_engagement=a.min_engagement,
            min_mentions=a.min_mentions,
            is_active=a.is_active,
            created_at=a.created_at,
        )
        for a in alerts
    ]


@app.put("/api/watchlist/custom-alerts/{alert_id}")
def update_alert(
    alert_id: int,
    payload: CustomAlertRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CustomAlertResponse:
    """Update a custom alert."""
    alert = update_custom_alert(
        db,
        alert_id,
        current_user.id,
        name=payload.name,
        keywords=payload.keywords,
        regions=payload.regions,
        alert_type=payload.alert_type,
        min_engagement=payload.min_engagement,
        min_mentions=payload.min_mentions,
    )
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return CustomAlertResponse(
        id=alert.id,
        name=alert.name,
        keywords=json.loads(alert.keywords),
        regions=json.loads(alert.regions),
        alert_type=alert.alert_type,
        min_engagement=alert.min_engagement,
        min_mentions=alert.min_mentions,
        is_active=alert.is_active,
        created_at=alert.created_at,
    )


@app.delete("/api/watchlist/custom-alerts/{alert_id}")
def remove_custom_alert(
    alert_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a custom alert."""
    if not delete_custom_alert(db, alert_id, current_user.id):
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"deleted": True}


@app.get("/")
def read_root():
    return {"project": "Social Radar", "status": "running"}


@app.get("/api/health")
def read_health():
    return {"ok": True}


@app.get("/api/trends")
def read_trends():
    """
    Primary trends endpoint consumed by the frontend dashboard.
    Fetches live data from Reddit RSS feeds.
    Always returns valid JSON array (empty if feeds unavailable).
    """
    try:
        trends = fetch_reddit_rss_trends()
        logger.info("✓ /api/trends returned %d trend(s)", len(trends))
        return trends
    except Exception as exc:
        logger.error("✗ Unexpected error in /api/trends: %s", exc)
        return []


@app.get("/api/trends/reddit")
def read_reddit_trends():
    """
    Dedicated Reddit trends endpoint via public subreddit RSS feeds.
    Always returns valid JSON array (empty if feeds unavailable).
    """
    try:
        trends = fetch_reddit_rss_trends()
        logger.info("✓ /api/trends/reddit returned %d trend(s)", len(trends))
        return trends
    except Exception as exc:
        logger.error("✗ Unexpected error in /api/trends/reddit: %s", exc)
        return []


@app.get("/api/trends/youtube")
def read_youtube_trends(
    region: list[str] | None = Query(default=None),
    topic: list[str] | None = Query(default=None),
    limit: int = Query(default=10, ge=1, le=25),
):
    """
    YouTube trends endpoint with optional regional and topic filtering.
    Always returns valid JSON array (empty if API unavailable).
    """
    try:
        trends = fetch_youtube_trends(
            regions=tuple(region) if region else None,
            topics=tuple(topic) if topic else None,
            limit=limit,
        )
        logger.info("✓ /api/trends/youtube returned %d trend(s)", len(trends))
        return trends
    except Exception as exc:
        logger.error("✗ Unexpected error in /api/trends/youtube: %s", exc)
        return []


@app.get("/api/trends/live")
def read_live_trends():
    """
    Combined live trends from all sources (Reddit, YouTube).
    Returns data from available sources; graceful degradation if one source fails.
    Always returns valid JSON array (empty if all sources unavailable).
    """
    try:
        trends = fetch_live_trends()
        logger.info("✓ /api/trends/live returned %d trend(s)", len(trends))
        return trends
    except Exception as exc:
        logger.error("✗ Unexpected error in /api/trends/live: %s", exc)
        return []


@app.get("/api/search")
def read_search(
    q: str = Query(..., min_length=1),
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    try:
        return search_events(db=db, query=q, limit=limit)
    except SQLAlchemyError as exc:
        logger.exception("Database failure in /api/search", exc_info=exc)
        raise HTTPException(status_code=500, detail="Database failure") from exc


@app.get("/api/trends/regions")
def read_trend_regions(db: Session = Depends(get_db)):
    try:
        regions = get_available_regions(db=db)
        return {
            "count": len(regions),
            "regions": regions,
        }
    except SQLAlchemyError as exc:
        logger.exception("Database failure in /api/trends/regions", exc_info=exc)
        raise HTTPException(status_code=500, detail="Database failure") from exc


@app.get("/api/trends/region")
def read_trends_by_region(
    name: str | None = Query(default=None),
    country: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    if not name and not country:
        name = "Global"

    try:
        resolved_region, trends = get_region_trends(
            db=db,
            region_name=name,
            country=country,
            limit=limit,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "region": resolved_region,
        "country": country,
        "available_regions": REGION_ORDER,
        "count": len(trends),
        "items": trends,
    }


@app.get("/api/history")
def read_history_by_date(
    date: date = Query(..., description="Date in YYYY-MM-DD format"),
    db: Session = Depends(get_db),
):
    start_dt = datetime.combine(date, datetime.min.time())
    end_dt = start_dt + timedelta(days=1)

    try:
        rows = (
            db.query(models.HistoricalTrend)
            .filter(models.HistoricalTrend.snapshot_time >= start_dt)
            .filter(models.HistoricalTrend.snapshot_time < end_dt)
            .order_by(models.HistoricalTrend.snapshot_time.desc(), models.HistoricalTrend.score.desc())
            .all()
        )

        return {
            "date": date.isoformat(),
            "count": len(rows),
            "items": [
                {
                    "id": row.id,
                    "title": row.title,
                    "keyword": row.keyword,
                    "platform": row.platform,
                    "country": row.country,
                    "mentions": row.mentions,
                    "engagement": row.engagement,
                    "score": row.score,
                    "created_at": row.created_at.isoformat() if row.created_at else None,
                    "snapshot_time": row.snapshot_time.isoformat() if row.snapshot_time else None,
                }
                for row in rows
            ],
        }
    except SQLAlchemyError as exc:
        logger.exception("Database failure in /api/history", exc_info=exc)
        raise HTTPException(status_code=500, detail="Database failure") from exc


@app.get("/api/history/range")
def read_history_range(
    from_date: date = Query(..., alias="from", description="Start date in YYYY-MM-DD format"),
    to_date: date = Query(..., alias="to", description="End date in YYYY-MM-DD format"),
    db: Session = Depends(get_db),
):
    if from_date > to_date:
        raise HTTPException(status_code=400, detail="'from' must be less than or equal to 'to'")

    start_dt = datetime.combine(from_date, datetime.min.time())
    end_dt = datetime.combine(to_date + timedelta(days=1), datetime.min.time())

    try:
        grouped_rows = (
            db.query(
                models.HistoricalTrend.title.label("title"),
                models.HistoricalTrend.keyword.label("keyword"),
                models.HistoricalTrend.platform.label("platform"),
                models.HistoricalTrend.country.label("country"),
                func.count(models.HistoricalTrend.id).label("snapshots"),
                func.sum(models.HistoricalTrend.mentions).label("total_mentions"),
                func.sum(models.HistoricalTrend.engagement).label("total_engagement"),
                func.avg(models.HistoricalTrend.score).label("avg_score"),
                func.max(models.HistoricalTrend.snapshot_time).label("last_snapshot_time"),
            )
            .filter(models.HistoricalTrend.snapshot_time >= start_dt)
            .filter(models.HistoricalTrend.snapshot_time < end_dt)
            .group_by(
                models.HistoricalTrend.title,
                models.HistoricalTrend.keyword,
                models.HistoricalTrend.platform,
                models.HistoricalTrend.country,
            )
            .order_by(
                func.sum(models.HistoricalTrend.engagement).desc(),
                func.sum(models.HistoricalTrend.mentions).desc(),
            )
            .all()
        )

        return {
            "from": from_date.isoformat(),
            "to": to_date.isoformat(),
            "count": len(grouped_rows),
            "items": [
                {
                    "title": row.title,
                    "keyword": row.keyword,
                    "platform": row.platform,
                    "country": row.country,
                    "snapshots": int(row.snapshots or 0),
                    "total_mentions": int(row.total_mentions or 0),
                    "total_engagement": int(row.total_engagement or 0),
                    "avg_score": round(float(row.avg_score or 0.0), 2),
                    "last_snapshot_time": (
                        row.last_snapshot_time.isoformat() if row.last_snapshot_time else None
                    ),
                }
                for row in grouped_rows
            ],
        }
    except SQLAlchemyError as exc:
        logger.exception("Database failure in /api/history/range", exc_info=exc)
        raise HTTPException(status_code=500, detail="Database failure") from exc


# Country coordinates for map hotspots
COUNTRY_COORDS = {
    "US": {"lat": 37.0902, "lng": -95.7129},
    "GB": {"lat": 55.3781, "lng": -3.4360},
    "CA": {"lat": 56.1304, "lng": -106.3468},
    "AU": {"lat": -25.2744, "lng": 133.7751},
    "DE": {"lat": 51.1657, "lng": 10.4515},
    "FR": {"lat": 46.2276, "lng": 2.2137},
    "JP": {"lat": 36.2048, "lng": 138.2529},
    "IN": {"lat": 20.5937, "lng": 78.9629},
    "BR": {"lat": -14.2350, "lng": -51.9253},
    "MX": {"lat": 23.6345, "lng": -102.5528},
    "RU": {"lat": 61.5240, "lng": 105.3188},
    "KR": {"lat": 35.9078, "lng": 127.7669},
    "ZA": {"lat": -30.5595, "lng": 22.9375},
    "SG": {"lat": 1.3521, "lng": 103.8198},
    "IT": {"lat": 41.8719, "lng": 12.5674},
    "ES": {"lat": 40.4637, "lng": -3.7492},
    "NG": {"lat": 9.0820, "lng": 8.6753},
    "PK": {"lat": 30.3753, "lng": 69.3451},
    "ID": {"lat": -0.7893, "lng": 113.9213},
    "NL": {"lat": 52.1326, "lng": 5.2913},
    "SE": {"lat": 60.1282, "lng": 18.6435},
    "CH": {"lat": 46.8182, "lng": 8.2275},
    "AR": {"lat": -38.4161, "lng": -63.6167},
    "TR": {"lat": 38.9637, "lng": 35.2433},
    "AE": {"lat": 23.4241, "lng": 53.8478},
    "TH": {"lat": 15.8700, "lng": 100.9925},
    "PH": {"lat": 12.8797, "lng": 121.7740},
    "VN": {"lat": 14.0583, "lng": 108.2772},
    "CN": {"lat": 35.8617, "lng": 104.1954},
}


class HotspotData(BaseModel):
    country: str
    lat: float
    lng: float
    score: float
    category: str

class AlertData(BaseModel):
    id: str
    keyword: str
    country: str
    platform: str
    old_score: float
    new_score: float
    delta: float
    severity: str
    message: str
    timestamp: str


@app.get("/api/map/hotspots")
def read_map_hotspots(db: Session = Depends(get_db)):
    """
    Returns geolocated hotspots based on trend volume by country.
    Aggregates trends by country, calculates scores, and includes coordinates for map visualization.
    """
    try:
        hotspots = build_map_hotspots(fetch_live_trends(), COUNTRY_COORDS)

        if not hotspots:
            fallback_rows = (
                db.query(models.HistoricalTrend)
                .order_by(models.HistoricalTrend.snapshot_time.desc(), models.HistoricalTrend.score.desc())
                .limit(100)
                .all()
            )
            hotspots = build_map_hotspots(
                [
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
                    for row in fallback_rows
                ],
                COUNTRY_COORDS,
            )

        return {
            "count": len(hotspots),
            "hotspots": [HotspotData(**hotspot) for hotspot in hotspots],
        }
    except SQLAlchemyError as exc:
        logger.exception("Database failure in /api/map/hotspots", exc_info=exc)
        raise HTTPException(status_code=500, detail="Database failure") from exc


@app.get("/api/map/country")
def read_map_country_intelligence(
    name: str = Query(..., min_length=1),
    platform: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """
    Get intelligence for a specific country.
    Returns trends, hashtags, platforms, and engagement metrics filtered by country.
    """
    try:
        return build_location_intelligence(
            db,
            name=name,
            scope="country",
            platform=platform,
        )
    except SQLAlchemyError as exc:
        logger.exception("Database failure in /api/map/country", exc_info=exc)
        raise HTTPException(status_code=500, detail="Database failure") from exc
    except Exception as exc:
        logger.exception("Error in /api/map/country", exc_info=exc)
        raise HTTPException(status_code=500, detail="Internal server error") from exc


@app.get("/api/map/region")
def read_map_region_intelligence(
    name: str = Query(..., min_length=1),
    platform: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """
    Get intelligence for a specific region (e.g., Asia, Europe).
    Uses country_region mapping to find all countries in the region.
    """
    try:
        return build_location_intelligence(
            db,
            name=name,
            scope="region",
            platform=platform,
        )
    except SQLAlchemyError as exc:
        logger.exception("Database failure in /api/map/region", exc_info=exc)
        raise HTTPException(status_code=500, detail="Database failure") from exc
    except Exception as exc:
        logger.exception("Error in /api/map/region", exc_info=exc)
        raise HTTPException(status_code=500, detail="Internal server error") from exc

def read_live_alerts(db: Session = Depends(get_db)):
    """
    Detect sudden trend spikes by comparing current trends with historical snapshots.
    If no spikes detected, generate fallback alerts from top live trends.
    Returns max 5 alerts with severity levels.
    """
    try:
        current_trends = db.query(models.Trend).order_by(models.Trend.trend_score.desc()).limit(100).all()
        alerts = []
        
        # Stage 1: Real spike detection
        for t in current_trends:
            # Look up the most recent snapshot for this keyword and country
            last_snapshot = (
                db.query(models.HistoricalTrend)
                .filter(
                    models.HistoricalTrend.keyword == t.keyword,
                    models.HistoricalTrend.country == t.country
                )
                .order_by(models.HistoricalTrend.snapshot_time.desc())
                .first()
            )
            
            old_score = last_snapshot.score if last_snapshot else (t.trend_score * 0.5) # Mock old score if new
            score_diff = t.trend_score - old_score
            
            # Threshold for alert
            if score_diff >= 10.0 or (old_score > 0 and (score_diff / old_score) > 0.5 and score_diff >= 5.0):
                severity = "high" if score_diff > 30 else ("medium" if score_diff > 20 else "low")
                
                alerts.append(AlertData(
                    id=f"alert-{t.id}-{int(t.created_at.timestamp() if t.created_at else 0)}",
                    keyword=t.keyword,
                    country=t.country or "Global",
                    platform=t.platform or "Unknown",
                    old_score=round(old_score, 2),
                    new_score=round(t.trend_score, 2),
                    delta=round(score_diff, 2),
                    severity=severity,
                    message=f"Spike detected for '{t.keyword}' in {t.country or 'Global'}",
                    timestamp=datetime.utcnow().isoformat()
                ))
        
        # Sort by delta descending
        alerts.sort(key=lambda x: x.delta, reverse=True)
        
        # Stage 2: Fallback alerts from top trends (if no spikes detected)
        if len(alerts) == 0:
            fallback_trends = current_trends[:10]
            for t in fallback_trends:
                # Determine severity based on trend_score
                if t.trend_score >= 80:
                    severity = "high"
                elif t.trend_score >= 50:
                    severity = "medium"
                else:
                    severity = "low"
                
                # Generate contextual message
                location = t.country or "Global"
                plat = t.platform or "cross-platform"
                
                # Create descriptive message matching user examples
                if location == "Global":
                    message = f"'{t.keyword}' trend rising globally"
                elif plat != "cross-platform":
                    message = f"'{t.keyword}' surging in {location} {plat}"
                else:
                    message = f"'{t.keyword}' trending in {location}"
                
                alerts.append(AlertData(
                    id=f"fallback-{t.id}-{int(t.created_at.timestamp() if t.created_at else 0)}",
                    keyword=t.keyword,
                    country=location,
                    platform=plat,
                    old_score=round(t.trend_score * 0.7, 2),  # Estimated previous score
                    new_score=round(t.trend_score, 2),
                    delta=round(t.trend_score * 0.3, 2),  # Estimated delta
                    severity=severity,
                    message=message,
                    timestamp=datetime.utcnow().isoformat()
                ))
        
        # Sort by new_score descending for consistent ranking
        alerts.sort(key=lambda x: x.new_score, reverse=True)
        
        # Cap at max 5 alerts
        alerts = alerts[:5]
        
        return {
            "count": len(alerts),
            "alerts": alerts
        }
    except SQLAlchemyError as exc:
        logger.exception("Database failure in /api/alerts/live", exc_info=exc)
        raise HTTPException(status_code=500, detail="Database failure") from exc


@app.post("/api/ai/summary")
def read_ai_summary(payload: AISummaryRequest, db: Session = Depends(get_db)):
    try:
        return generate_ai_summary(
            db=db,
            query=payload.query,
            region=payload.region,
            days=payload.days,
            mode=payload.mode,
        )
    except SQLAlchemyError as exc:
        logger.exception("Database failure in /api/ai/summary", exc_info=exc)
        raise HTTPException(status_code=500, detail="Database failure") from exc

@app.get("/api/export/csv")
def export_csv(
    type: str = Query("live", description="'live' or 'historical'"),
    report_date: str | None = Query(None, alias="date"),
    db: Session = Depends(get_db)
):
    output = io.StringIO()
    writer = csv.writer(output)
    
    if type == "live":
        trends = db.query(models.Trend).order_by(models.Trend.trend_score.desc()).all()
        writer.writerow(["ID", "Keyword", "Country", "Platform", "Score", "Category", "Created At"])
        for t in trends:
            writer.writerow([t.id, t.keyword, t.country, t.platform, t.trend_score, t.category, t.created_at])
    elif type == "historical" and report_date:
        start_dt = datetime.strptime(report_date, "%Y-%m-%d")
        end_dt = start_dt + timedelta(days=1)
        trends = db.query(models.HistoricalTrend).filter(
            models.HistoricalTrend.snapshot_time >= start_dt,
            models.HistoricalTrend.snapshot_time < end_dt
        ).order_by(models.HistoricalTrend.score.desc()).all()
        writer.writerow(["ID", "Keyword", "Country", "Platform", "Score", "Mentions", "Engagement", "Snapshot Time"])
        for t in trends:
            writer.writerow([t.id, t.keyword, t.country, t.platform, t.score, t.mentions, t.engagement, t.snapshot_time])
            
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]), 
        media_type="text/csv", 
        headers={"Content-Disposition": f"attachment; filename=export_{type}.csv"}
    )

@app.get("/api/export/pdf")
def export_pdf(
    type: str = Query("live", description="'live' or 'historical'"),
    report_date: str | None = Query(None, alias="date"),
    db: Session = Depends(get_db)
):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", "B", 16)
    
    if type == "live":
        pdf.cell(200, 10, txt="Social Radar - Live Trends Report", ln=1, align="C")
        pdf.set_font("Arial", size=10)
        trends = db.query(models.Trend).order_by(models.Trend.trend_score.desc()).limit(100).all()
        for t in trends:
            # Handle unicode gracefully by replacing
            keyword = t.keyword.encode('latin-1', 'replace').decode('latin-1')
            country = t.country.encode('latin-1', 'replace').decode('latin-1') if t.country else 'Global'
            pdf.cell(200, 10, txt=f"{keyword} ({country}) - Score: {t.trend_score:.2f}", ln=1)
    elif type == "historical" and report_date:
        pdf.cell(200, 10, txt=f"Social Radar - Historical Report ({report_date})", ln=1, align="C")
        pdf.set_font("Arial", size=10)
        start_dt = datetime.strptime(report_date, "%Y-%m-%d")
        end_dt = start_dt + timedelta(days=1)
        trends = db.query(models.HistoricalTrend).filter(
            models.HistoricalTrend.snapshot_time >= start_dt,
            models.HistoricalTrend.snapshot_time < end_dt
        ).order_by(models.HistoricalTrend.score.desc()).limit(100).all()
        for t in trends:
            keyword = t.keyword.encode('latin-1', 'replace').decode('latin-1')
            country = t.country.encode('latin-1', 'replace').decode('latin-1') if t.country else 'Global'
            pdf.cell(200, 10, txt=f"{keyword} ({country}) - Score: {t.score:.2f} - Mentions: {t.mentions}", ln=1)
            
    pdf_bytes = pdf.output(dest='S').encode('latin-1')
    return StreamingResponse(
        io.BytesIO(pdf_bytes), 
        media_type="application/pdf", 
        headers={"Content-Disposition": f"attachment; filename=export_{type}.pdf"}
    )
