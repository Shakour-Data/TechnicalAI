from sqlalchemy import Column, String, Float, DateTime, Integer, Text, Index, Boolean
from sqlalchemy.sql import func
from .database import Base

class ForexRate(Base):
    __tablename__ = 'forex_rates'
    id = Column(String, primary_key=True, index=True)
    pair = Column(String(20), nullable=False, index=True)
    base_currency = Column(String(10), nullable=False)
    target_currency = Column(String(10), nullable=False)
    rate = Column(Float, nullable=False)
    bid = Column(Float)
    ask = Column(Float)
    change = Column(Float)
    change_pct = Column(Float)
    high = Column(Float)
    low = Column(Float)
    volume = Column(Float)
    source = Column(String(50), nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    is_realtime = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index('ix_forex_pair_timestamp', 'pair', 'timestamp'),
        Index('ix_forex_timestamp', 'timestamp'),
    )
