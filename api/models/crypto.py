from sqlalchemy import Column, String, Float, DateTime, Integer, Text, Index, Boolean
from sqlalchemy.sql import func
from .database import Base

class CryptoPrice(Base):
    __tablename__ = 'crypto_prices'
    id = Column(String, primary_key=True, index=True)
    symbol = Column(String(20), nullable=False, index=True)
    name = Column(String(100))
    name_en = Column(String(100))
    price_usd = Column(Float, nullable=False)
    price_rial = Column(Float)
    change = Column(Float)
    change_pct = Column(Float)
    high = Column(Float)
    low = Column(Float)
    volume = Column(Float)
    market_cap = Column(Float)
    source = Column(String(50), nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    is_realtime = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index('ix_crypto_symbol_timestamp', 'symbol', 'timestamp'),
        Index('ix_crypto_timestamp', 'timestamp'),
    )
