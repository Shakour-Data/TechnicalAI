from sqlalchemy import Column, String, Float, DateTime, Integer, Text, Index, Boolean, JSON, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base

class TimeSeriesAnalysis(Base):
    __tablename__ = 'time_series_analyses'
    id = Column(String, primary_key=True, index=True)
    symbol = Column(String(50), nullable=False, index=True)
    request_params = Column(Text)  # JSON string of request parameters
    basic_stats = Column(Text)     # JSON string of basic statistics
    analysis_json = Column(Text)   # Full analysis JSON result
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    results = relationship("TimeSeriesResult", back_populates="analysis", cascade="all, delete-orphan")

    __table_args__ = (
        Index('ix_time_series_analyses_symbol_created', 'symbol', 'created_at'),
    )


class TimeSeriesResult(Base):
    __tablename__ = 'time_series_results'
    id = Column(String, primary_key=True, index=True)
    analysis_id = Column(String, nullable=False, index=True)
    model = Column(String(50), nullable=False, index=True)
    forecast_json = Column(Text)   # JSON array of forecast values with confidence intervals
    metrics_json = Column(Text)    # JSON object of in-sample metrics
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    analysis = relationship("TimeSeriesAnalysis", back_populates="results")

    __table_args__ = (
        Index('ix_time_series_results_analysis_model', 'analysis_id', 'model'),
    )


def create_time_series_analysis(
    db,
    symbol: str,
    request_params: dict,
    basic_stats: dict,
    analysis_json: dict,
) -> TimeSeriesAnalysis:
    """Create a time series analysis record."""
    analysis = TimeSeriesAnalysis(
        id=f"tsa_{symbol}_{int(func.now().timestamp() * 1000)}",
        symbol=symbol,
        request_params=str(request_params),
        basic_stats=str(basic_stats),
        analysis_json=str(analysis_json),
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return analysis


def create_time_series_result(db, analysis_id: str, model: str, forecast: dict, metrics: dict) -> TimeSeriesResult:
    """Create a time series forecast result."""
    result = TimeSeriesResult(
        id=f"tsr_{analysis_id}_{model}",
        analysis_id=analysis_id,
        model=model,
        forecast_json=str(forecast),
        metrics_json=str(metrics),
    )
    db.add(result)
    db.commit()
    db.refresh(result)
    return result


def get_time_series_analysis(db, analysis_id: str) -> TimeSeriesAnalysis:
    """Get a time series analysis by ID."""
    return db.query(TimeSeriesAnalysis).filter(TimeSeriesAnalysis.id == analysis_id).first()


def get_time_series_results(db, analysis_id: str) -> list:
    """Get all forecast results for an analysis."""
    return db.query(TimeSeriesResult).filter(TimeSeriesResult.analysis_id == analysis_id).all()
