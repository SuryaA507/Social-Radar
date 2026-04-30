from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    saved_searches = relationship("SavedSearch", back_populates="user", cascade="all, delete-orphan")
    tracked_topics = relationship("TrackedTopic", back_populates="user", cascade="all, delete-orphan")
    saved_regions = relationship("SavedRegion", back_populates="user", cascade="all, delete-orphan")
    custom_alerts = relationship("CustomAlert", back_populates="user", cascade="all, delete-orphan")


class SavedSearch(Base):
    __tablename__ = "saved_searches"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    name = Column(String)
    query = Column(String)
    region = Column(String, default="Global")
    days = Column(Integer, default=7)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship
    user = relationship("User", back_populates="saved_searches")


class TrackedTopic(Base):
    __tablename__ = "tracked_topics"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    topic = Column(String, index=True)
    keywords = Column(Text)  # JSON: list of keywords
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship
    user = relationship("User", back_populates="tracked_topics")


class SavedRegion(Base):
    __tablename__ = "saved_regions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    region = Column(String, index=True)
    label = Column(String)  # Custom display name
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship
    user = relationship("User", back_populates="saved_regions")


class CustomAlert(Base):
    __tablename__ = "custom_alerts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    name = Column(String)
    keywords = Column(Text)  # JSON: list of keywords to watch
    regions = Column(Text)  # JSON: list of regions
    min_engagement = Column(Integer, default=0)  # Alert threshold
    min_mentions = Column(Integer, default=0)    # Alert threshold
    alert_type = Column(String, default="spike")  # spike, risk, opportunity, viral
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationship
    user = relationship("User", back_populates="custom_alerts")


class Trend(Base):
    __tablename__ = "trends"

    id = Column(Integer, primary_key=True, index=True)
    keyword = Column(String, index=True)
    platform = Column(String, index=True)
    country = Column(String, index=True)
    mentions = Column(Integer, default=0)
    engagement = Column(Integer, default=0)
    sentiment = Column(Float, default=0.0)
    trend_score = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class HistoricalTrend(Base):
    __tablename__ = "historical_trends"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    keyword = Column(String, index=True)
    platform = Column(String, index=True)
    country = Column(String, index=True)
    mentions = Column(Integer, default=0)
    engagement = Column(Integer, default=0)
    score = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), nullable=True)
    snapshot_time = Column(DateTime(timezone=True), server_default=func.now())
