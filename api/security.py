"""Security utilities for TechnicalAI Backend."""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
import logging

logger = logging.getLogger(__name__)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
SECRET_KEY = "your-secret-key-change-in-production"  # Should come from settings
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: Dict[str, Any]) -> str:
    """Create JWT refresh token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify and decode JWT token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        logger.warning(f"JWT verification failed: {e}")
        return None

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)

class User:
    """User model for authentication."""
    def __init__(self, user_id: str, username: str, email: str, role: str = "user"):
        self.user_id = user_id
        self.username = username
        self.email = email
        self.role = role
        self.is_active = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "is_active": self.is_active
        }

# Mock user database - in production this would be replaced with real DB
MOCK_USERS = {
    "admin": User(
        user_id="admin-001",
        username="admin",
        email="admin@technicalai.ir",
        role="admin"
    ),
    "api_user": User(
        user_id="api-001", 
        username="api_user",
        email="api@technicalai.ir",
        role="user"
    )
}

def authenticate_user(username: str, password: str) -> Optional[User]:
    """Authenticate user with username and password."""
    # For demo purposes - in production check against real database
    user = MOCK_USERS.get(username)
    if user and verify_password(password, get_password_hash("demo123")):  # Demo password
        return user
    return None

def get_user_by_id(user_id: str) -> Optional[User]:
    """Get user by ID."""
    for user in MOCK_USERS.values():
        if user.user_id == user_id:
            return user
    return None