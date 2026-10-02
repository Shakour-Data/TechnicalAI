"""Models for historical data and probability snapshots."""
from sqlalchemy import Column, String, Float, DateTime, Integer, Index, JSON, Text, Boolean
from sqlalchemy.sql import func
from .database import Base


class HistoricalData(Base):
    __tablename__ = 'historical_data'
    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String(50), nullable=False)
    instrument_type = Column(String(50), nullable=False)  # index, sector, stock
    date = Column(String(20), nullable=False)
    open_price = Column(Float, nullable=False)
    high = Column(Float, nullable=False)
    low = Column(Float, nullable=False)
    close = Column(Float, nullable=False)
    volume = Column(Float, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index('ix_historical_data_symbol_date', 'symbol', 'date', unique=True),
        Index('ix_historical_data_symbol', 'symbol'),
        Index('ix_historical_data_date', 'date'),
    )


class HistoricalProbabilitySnapshot(Base):
    __tablename__ = 'historical_probability_snapshots'
    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String(50), nullable=False, index=True)
    date = Column(String(20), nullable=False, index=True)
    scenario = Column(String(10), nullable=False)  # SC1-SC9
    probability = Column(Float, nullable=False)
    forward_return = Column(Float)  # 5-day forward return
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index('ix_prob_snap_symbol_date', 'symbol', 'date'),
        Index('ix_prob_snap_symbol_scenario', 'symbol', 'scenario'),
    )


class CalibratedParameters(Base):
    __tablename__ = 'calibrated_parameters'
    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String(50), nullable=False, index=True)
    branch = Column(String(50), nullable=False)  # trend, breakout, reversal
    parameter_name = Column(String(100), nullable=False)
    parameter_value = Column(Float, nullable=False)
    calibration_date = Column(DateTime(timezone=True), server_default=func.now())
    window_size = Column(Integer, default=30)
    data_points = Column(Integer, default=0)
    parameter_std = Column(Float, default=0)
    version = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index('ix_calib_params_symbol_branch', 'symbol', 'branch'),
        Index('ix_calib_params_symbol_date', 'symbol', 'calibration_date'),
    )


class ModelVersion(Base):
    __tablename__ = 'model_versions'
    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String(50), nullable=False, index=True)
    model_key = Column(String(100), nullable=False)
    version = Column(Integer, nullable=False)
    model_data = Column(Text)  # JSON serialized model
    model_metadata = Column(JSON)  # Training metadata (renamed from 'metadata' to avoid SQLAlchemy reserved name)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)

    __table_args__ = (
        Index('ix_model_versions_symbol_key', 'symbol', 'model_key'),
        Index('ix_model_versions_active', 'is_active'),
    )


class BacktestResult(Base):
    __tablename__ = 'backtest_results'
    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String(50), nullable=False, index=True)
    parameter_set_id = Column(Integer)
    window_start = Column(String(20))
    window_end = Column(String(20))
    metrics = Column(JSON)  # accuracy, precision, recall, F1, sharpe, etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index('ix_backtest_symbol', 'symbol'),
        Index('ix_backtest_window', 'window_start', 'window_end'),
    )