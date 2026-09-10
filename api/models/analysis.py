from sqlalchemy import Column, String, Float, DateTime, Integer, Text, Index, Boolean, JSON
from sqlalchemy.sql import func
from .database import Base

class Analysis(Base):
    __tablename__ = 'analyses'
    id = Column(String, primary_key=True, index=True)
    symbol = Column(String(50), nullable=False, index=True)
    instrument_type = Column(String(50), nullable=False)
    analysis_type = Column(String(50), nullable=False)
    prompt = Column(Text)
    response = Column(Text)
    model_used = Column(String(100))
    confidence_score = Column(Float)
    status = Column(String(20), default='pending')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))

    __table_args__ = (
        Index('ix_analyses_symbol_type', 'symbol', 'analysis_type'),
        Index('ix_analyses_status', 'status'),
    )

class AnalysisResult(Base):
    __tablename__ = 'analysis_results'
    id = Column(String, primary_key=True, index=True)
    analysis_id = Column(String, nullable=False, index=True)
    metric_name = Column(String(100), nullable=False)
    metric_value = Column(Float)
    metric_text = Column(Text)
    recommendation = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index('ix_analysis_results_analysis', 'analysis_id'),
    )
