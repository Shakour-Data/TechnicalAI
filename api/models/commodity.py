from sqlalchemy import Column, String, Float, DateTime, Integer, Text, Index, Boolean
from sqlalchemy.sql import func
from .database import Base

class CommodityPrice(Base):
    __tablename__ = 'commodity_prices'
    id = Column(String, primary_key=True, index=True)
    symbol = Column(String(30), nullable=False, index=True)
    name = Column(String(200))
    name_en = Column(String(200))
    category = Column(String(50), nullable=False)
    price = Column(Float, nullable=False)
    unit = Column(String(50))
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
        Index('ix_commodity_symbol_timestamp', 'symbol', 'timestamp'),
        Index('ix_commodity_timestamp', 'timestamp'),
    )
