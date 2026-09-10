from sqlalchemy import Column, String, Float, DateTime, Integer, Text, Boolean, Index
from sqlalchemy.sql import func
from .database import Base

class MarketIndex(Base):
    __tablename__ = 'indices'
    id = Column(String, primary_key=True, index=True)
    code = Column(String(20), nullable=False, unique=True, index=True)
    name = Column(String(200), nullable=False)
    name_en = Column(String(200))
    market = Column(String(50), nullable=False)
    category = Column(String(50), default='main')
    web_id = Column(String(20))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index('ix_indices_code', 'code'),
        Index('ix_indices_market', 'market'),
    )

class IndexHistory(Base):
    __tablename__ = 'index_history'
    id = Column(String, primary_key=True, index=True)
    index_id = Column(String, nullable=False, index=True)
    date = Column(String(10), nullable=False, index=True)
    j_date = Column(String(10))
    open_price = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    volume = Column(Float)
    previous_close = Column(Float)
    change_pct = Column(Float)
    is_realtime = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index('idx_index_history_index', 'index_id'),
        Index('idx_index_history_date', 'date'),
    )