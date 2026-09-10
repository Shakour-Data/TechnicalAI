from sqlalchemy import Column, String, Float, DateTime, Integer, Text, Index, Boolean
from sqlalchemy.sql import func
from .database import Base

class Stock(Base):
    __tablename__ = 'stocks'
    id = Column(String, primary_key=True, index=True)
    symbol = Column(String(20), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    name_en = Column(String(200))
    market = Column(String(50), nullable=False, index=True)
    exchange = Column(String(50))
    sector = Column(String(100))
    currency = Column(String(10), default='IRR')
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        Index('ix_stocks_symbol_market', 'symbol', 'market'),
        Index('ix_stocks_market', 'market'),
    )

class StockHistory(Base):
    __tablename__ = 'stock_history'
    id = Column(String, primary_key=True, index=True)
    stock_id = Column(String, nullable=False, index=True)
    date = Column(String(10), nullable=False, index=True)
    open_price = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    volume = Column(Float)
    adj_close = Column(Float)
    change_pct = Column(Float)
    is_realtime = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index('ix_stock_history_stock_date', 'stock_id', 'date'),
        Index('ix_stock_history_date', 'date'),
    )

class StockPrice(Base):
    __tablename__ = 'stock_prices'
    id = Column(String, primary_key=True, index=True)
    stock_id = Column(String, nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    price = Column(Float, nullable=False)
    bid = Column(Float)
    ask = Column(Float)
    volume = Column(Float)
    source = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index('ix_stock_prices_stock_timestamp', 'stock_id', 'timestamp'),
    )
