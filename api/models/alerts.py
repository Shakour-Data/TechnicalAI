from sqlalchemy import Column, String, Float, DateTime, Integer, Text, Boolean, Index
from sqlalchemy.sql import func
from .database import Base


class AlertConfiguration(Base):
    __tablename__ = "alert_configurations"

    id = Column(String, primary_key=True)
    user_id = Column(String)
    symbol = Column(String)
    condition = Column(String)
    threshold = Column(Float)
    severity = Column(String)
    is_active = Column(Boolean, default=True)
    channels = Column(String)
    last_triggered = Column(DateTime(timezone=True), nullable=True)
    trigger_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        Index("ix_alert_config_user_id", "user_id"),
        Index("ix_alert_config_symbol", "symbol"),
        Index("ix_alert_config_is_active", "is_active"),
    )


class AlertHistory(Base):
    __tablename__ = "alert_history"

    id = Column(String, primary_key=True)
    alert_config_id = Column(String)
    user_id = Column(String)
    symbol = Column(String)
    triggered_at = Column(DateTime(timezone=True), server_default=func.now())
    value = Column(Float)
    message = Column(String)
    severity = Column(String)
    channel = Column(String)
    delivered = Column(Boolean, default=False)
    delivered_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_alert_history_config_id", "alert_config_id"),
        Index("ix_alert_history_user_id", "user_id"),
        Index("ix_alert_history_triggered_at", "triggered_at"),
        Index("ix_alert_history_delivered", "delivered"),
    )


class UserPreferences(Base):
    __tablename__ = "user_preferences"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, unique=True, index=True)

    watchlists = Column(String)
    default_sc9_threshold = Column(Float, default=30.0)
    default_sc1_threshold = Column(Float, default=30.0)
    default_adx_threshold = Column(Float, default=20.0)

    email_notifications = Column(Boolean, default=True)
    sms_notifications = Column(Boolean, default=False)
    webhook_url = Column(String, nullable=True)

    theme_id = Column(String, default="white-blue")
    language = Column(String, default="fa")
    chart_type = Column(String, default="candlestick")
    report_schedule = Column(String, default="daily")
    report_time = Column(String, default="15:00")
    report_format = Column(String, default="pdf")
    report_recipients = Column(String)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class ReportGenerationLog(Base):
    __tablename__ = "report_generation_logs"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True)
    symbol = Column(String, nullable=True)
    report_type = Column(String)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    file_path = Column(String)
    file_size = Column(Integer)
    recipient_count = Column(Integer)
    status = Column(String)
    error_message = Column(String, nullable=True)

    __table_args__ = (
        Index("ix_report_user_id", "user_id"),
        Index("ix_report_generated_at", "generated_at"),
        Index("ix_report_status", "status"),
    )


class PerformanceMetrics(Base):
    __tablename__ = "performance_metrics"

    id = Column(String, primary_key=True, index=True)
    symbol = Column(String, index=True)
    date = Column(String, index=True)
    prediction_accuracy = Column(Float)
    calibration_error = Column(Float)
    sharpe_ratio = Column(Float, nullable=True)
    sortino_ratio = Column(Float, nullable=True)
    max_drawdown = Column(Float, nullable=True)
    calmar_ratio = Column(Float, nullable=True)
    total_return = Column(Float, nullable=True)
    annualized_return = Column(Float, nullable=True)
    volatility = Column(Float, nullable=True)
    scenario_sc1_accuracy = Column(Float, nullable=True)
    scenario_sc9_accuracy = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        Index("ix_perf_metrics_symbol", "symbol"),
        Index("ix_perf_metrics_date", "date"),
        Index("ix_perf_metrics_composite", "symbol", "date"),
    )


class WebSocketConnection(Base):
    __tablename__ = "websocket_connections"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, nullable=True, index=True)
    session_id = Column(String, index=True)
    connected_at = Column(DateTime(timezone=True), server_default=func.now())
    last_ping = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)
    user_agent = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)

    __table_args__ = (
        Index("ix_ws_session_id", "session_id"),
        Index("ix_ws_user_id", "user_id"),
        Index("ix_ws_is_active", "is_active"),
    )


class DecisionNode(Base):
    __tablename__ = "decision_nodes"

    id = Column(String, primary_key=True, index=True)
    label = Column(String)
    x = Column(Float, default=0)
    y = Column(Float, default=0)
    radius = Column(Float, default=20)
    color = Column(String, default="#3b82f6")
    children = Column(String, nullable=True)
    value = Column(Float, default=0)
    description = Column(String, nullable=True)
    scenario_id = Column(String, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        Index("ix_decision_node_scenario_id", "scenario_id"),
        Index("ix_decision_node_label", "label"),
    )


class DecisionEdge(Base):
    __tablename__ = "decision_edges"

    id = Column(String, primary_key=True, index=True)
    source_id = Column(String, index=True)
    target_id = Column(String, index=True)
    weight = Column(Float, default=1)
    type = Column(String, default="regular")

    __table_args__ = (
        Index("ix_decision_edge_source_id", "source_id"),
        Index("ix_decision_edge_target_id", "target_id"),
    )