import json
from typing import Any, Optional
from sqlalchemy.orm import Session
import models


def create_saved_search(
    db: Session,
    user_id: int,
    name: str,
    query: str,
    region: str = "Global",
    days: int = 7,
) -> models.SavedSearch:
    """Create a saved search."""
    search = models.SavedSearch(
        user_id=user_id,
        name=name,
        query=query,
        region=region,
        days=days,
    )
    db.add(search)
    db.commit()
    db.refresh(search)
    return search


def get_user_saved_searches(db: Session, user_id: int) -> list[models.SavedSearch]:
    """Get all saved searches for a user."""
    return db.query(models.SavedSearch).filter(models.SavedSearch.user_id == user_id).all()


def delete_saved_search(db: Session, search_id: int, user_id: int) -> bool:
    """Delete a saved search."""
    search = (
        db.query(models.SavedSearch)
        .filter(models.SavedSearch.id == search_id, models.SavedSearch.user_id == user_id)
        .first()
    )
    if search:
        db.delete(search)
        db.commit()
        return True
    return False


def create_tracked_topic(
    db: Session,
    user_id: int,
    topic: str,
    keywords: list[str],
) -> models.TrackedTopic:
    """Create a tracked topic."""
    tracked = models.TrackedTopic(
        user_id=user_id,
        topic=topic,
        keywords=json.dumps(keywords),
    )
    db.add(tracked)
    db.commit()
    db.refresh(tracked)
    return tracked


def get_user_tracked_topics(db: Session, user_id: int) -> list[models.TrackedTopic]:
    """Get all tracked topics for a user."""
    return db.query(models.TrackedTopic).filter(
        models.TrackedTopic.user_id == user_id,
        models.TrackedTopic.is_active == True,
    ).all()


def update_tracked_topic(
    db: Session,
    topic_id: int,
    user_id: int,
    keywords: list[str] = None,
    is_active: bool = None,
) -> Optional[models.TrackedTopic]:
    """Update a tracked topic."""
    topic = (
        db.query(models.TrackedTopic)
        .filter(models.TrackedTopic.id == topic_id, models.TrackedTopic.user_id == user_id)
        .first()
    )
    if not topic:
        return None
    if keywords is not None:
        topic.keywords = json.dumps(keywords)
    if is_active is not None:
        topic.is_active = is_active
    db.commit()
    db.refresh(topic)
    return topic


def delete_tracked_topic(db: Session, topic_id: int, user_id: int) -> bool:
    """Delete a tracked topic."""
    topic = (
        db.query(models.TrackedTopic)
        .filter(models.TrackedTopic.id == topic_id, models.TrackedTopic.user_id == user_id)
        .first()
    )
    if topic:
        db.delete(topic)
        db.commit()
        return True
    return False


def create_saved_region(
    db: Session,
    user_id: int,
    region: str,
    label: str = None,
) -> models.SavedRegion:
    """Create a saved region."""
    saved = models.SavedRegion(
        user_id=user_id,
        region=region,
        label=label or region,
    )
    db.add(saved)
    db.commit()
    db.refresh(saved)
    return saved


def get_user_saved_regions(db: Session, user_id: int) -> list[models.SavedRegion]:
    """Get all saved regions for a user."""
    return db.query(models.SavedRegion).filter(
        models.SavedRegion.user_id == user_id,
        models.SavedRegion.is_active == True,
    ).all()


def delete_saved_region(db: Session, region_id: int, user_id: int) -> bool:
    """Delete a saved region."""
    region = (
        db.query(models.SavedRegion)
        .filter(models.SavedRegion.id == region_id, models.SavedRegion.user_id == user_id)
        .first()
    )
    if region:
        db.delete(region)
        db.commit()
        return True
    return False


def create_custom_alert(
    db: Session,
    user_id: int,
    name: str,
    keywords: list[str],
    regions: list[str],
    alert_type: str = "spike",
    min_engagement: int = 0,
    min_mentions: int = 0,
) -> models.CustomAlert:
    """Create a custom alert."""
    alert = models.CustomAlert(
        user_id=user_id,
        name=name,
        keywords=json.dumps(keywords),
        regions=json.dumps(regions),
        alert_type=alert_type,
        min_engagement=min_engagement,
        min_mentions=min_mentions,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


def get_user_custom_alerts(db: Session, user_id: int) -> list[models.CustomAlert]:
    """Get all custom alerts for a user."""
    return db.query(models.CustomAlert).filter(
        models.CustomAlert.user_id == user_id,
        models.CustomAlert.is_active == True,
    ).all()


def update_custom_alert(
    db: Session,
    alert_id: int,
    user_id: int,
    name: str = None,
    keywords: list[str] = None,
    regions: list[str] = None,
    alert_type: str = None,
    min_engagement: int = None,
    min_mentions: int = None,
    is_active: bool = None,
) -> Optional[models.CustomAlert]:
    """Update a custom alert."""
    alert = (
        db.query(models.CustomAlert)
        .filter(models.CustomAlert.id == alert_id, models.CustomAlert.user_id == user_id)
        .first()
    )
    if not alert:
        return None
    if name is not None:
        alert.name = name
    if keywords is not None:
        alert.keywords = json.dumps(keywords)
    if regions is not None:
        alert.regions = json.dumps(regions)
    if alert_type is not None:
        alert.alert_type = alert_type
    if min_engagement is not None:
        alert.min_engagement = min_engagement
    if min_mentions is not None:
        alert.min_mentions = min_mentions
    if is_active is not None:
        alert.is_active = is_active
    db.commit()
    db.refresh(alert)
    return alert


def delete_custom_alert(db: Session, alert_id: int, user_id: int) -> bool:
    """Delete a custom alert."""
    alert = (
        db.query(models.CustomAlert)
        .filter(models.CustomAlert.id == alert_id, models.CustomAlert.user_id == user_id)
        .first()
    )
    if alert:
        db.delete(alert)
        db.commit()
        return True
    return False
