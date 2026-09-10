from sqlalchemy import Column, String, DateTime, Integer, Text, Index, Boolean
from sqlalchemy.sql import func
from .database import Base

class User(Base):
    __tablename__ = 'users'
    id = Column(String, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100))
    hashed_password = Column(String(255))
    role = Column(String(50), default='user', index=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ApiKey(Base):
    __tablename__ = 'api_keys'
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    key = Column(String(255), unique=True, nullable=False, index=True)
    is_active = Column(Boolean, default=True)
    expires_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class AuditLog(Base):
    __tablename__ = 'audit_logs'
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String)
    action = Column(String(100), nullable=False)
    resource = Column(String(100))
    ip_address = Column(String(50))
    details = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index('ix_audit_logs_user_action', 'user_id', 'action'),
        Index('ix_audit_logs_created', 'created_at'),
    )
