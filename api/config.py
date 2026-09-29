"""Configuration management for TechnicalAI Backend."""
import os
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    # Application
    app_name: str = "TechnicalAI Backend API"
    app_version: str = "2.0.0"
    debug: bool = Field(default=False, description="Debug mode")

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # Database
    database_url: str = Field(
        default="sqlite:///./technical_ai.db",
        description="Database connection URL"
    )

    # Redis
    redis_url: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URL"
    )

    # Security
    secret_key: str = Field(
        default="your-secret-key-change-in-production",
        description="JWT secret key"
    )
    algorithm: str = Field(default="HS256", description="JWT algorithm")
    access_token_expire_minutes: int = Field(
        default=30,
        description="Access token expiration in minutes"
    )
    refresh_token_expire_days: int = Field(
        default=7,
        description="Refresh token expiration in days"
    )

    # CORS
    allowed_origins: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:8000"],
        description="Allowed CORS origins"
    )
    allowed_methods: List[str] = Field(
        default=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        description="Allowed HTTP methods"
    )
    allowed_headers: List[str] = Field(
        default=["Content-Type", "Authorization", "X-Requested-With"],
        description="Allowed headers"
    )

    # Rate Limiting
    requests_per_minute: int = Field(
        default=120,
        description="Rate limit per minute per IP"
    )
    burst_limit: int = Field(
        default=20,
        description="Burst limit for rate limiting"
    )

    # Pagination
    default_page_size: int = Field(default=20, description="Default page size")
    max_page_size: int = Field(default=100, description="Maximum page size")

    # Cache
    cache_ttl_seconds: int = Field(
        default=300,
        description="Default cache TTL in seconds"
    )

    # External APIs
    tse_api_url: Optional[str] = Field(default=None, description="TSE API URL")
    forex_api_url: Optional[str] = Field(default=None, description="Forex API URL")

    # Monitoring
    prometheus_enabled: bool = Field(default=True, description="Enable Prometheus metrics")
    jaeger_endpoint: Optional[str] = Field(default=None, description="Jaeger endpoint")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"


settings = Settings()