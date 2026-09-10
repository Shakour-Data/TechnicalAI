from sqlalchemy import Column, String, Float, DateTime, Text, Index, Boolean
from sqlalchemy.sql import func
from .database import Base

class CacheEntry(Base):
    __tablename__ = 'cache_entries'
    id = Column(String, primary_key=True, index=True)
    key = Column(String(255), unique=True, nullable=False, index=True)
    value = Column(Text)
    ttl = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True))

    __table_args__ = (
        Index('ix_cache_expires', 'expires_at'),
    )
