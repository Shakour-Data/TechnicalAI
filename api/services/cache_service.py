import redis
from typing import Optional, Any, Dict
import json
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class CacheService:
    def __init__(self, redis_url: str = 'redis://localhost:6379/0'):
        self.redis_url = redis_url
        self.redis_client = None
        self._connect()

    def _connect(self):
        try:
            self.redis_client = redis.Redis.from_url(self.redis_url, decode_responses=True)
            # Test connection
            self.redis_client.ping()
            logger.info("Redis cache connected successfully")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}")
            self.redis_client = None

    def _serialize(self, obj: Any) -> str:
        return json.dumps(obj, default=str, ensure_ascii=False)

    def _deserialize(self, data: str) -> Any:
        try:
            return json.loads(data)
        except:
            return data

    async def get(self, key: str) -> Optional[Any]:
        if not self.redis_client:
            return None
        
        try:
            data = self.redis_client.get(key)
            if data:
                return self._deserialize(data)
            return None
        except Exception as e:
            logger.error(f"Error getting cache key {key}: {e}")
            return None

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        if not self.redis_client:
            return False
        
        try:
            serialized = self._serialize(value)
            if ttl:
                self.redis_client.setex(key, ttl, serialized)
            else:
                self.redis_client.set(key, serialized)
            return True
        except Exception as e:
            logger.error(f"Error setting cache key {key}: {e}")
            return False

    async def delete(self, key: str) -> bool:
        if not self.redis_client:
            return False
        
        try:
            return bool(self.redis_client.delete(key))
        except Exception as e:
            logger.error(f"Error deleting cache key {key}: {e}")
            return False

    async def exists(self, key: str) -> bool:
        if not self.redis_client:
            return False
        
        try:
            return bool(self.redis_client.exists(key))
        except Exception as e:
            logger.error(f"Error checking cache key {key}: {e}")
            return False

    async def clear_pattern(self, pattern: str) -> int:
        if not self.redis_client:
            return 0
        
        try:
            keys = self.redis_client.keys(pattern)
            if keys:
                return self.redis_client.delete(*keys)
            return 0
        except Exception as e:
            logger.error(f"Error clearing cache pattern {pattern}: {e}")
            return 0

    async def health_check(self) -> Dict[str, Any]:
        if not self.redis_client:
            return {'status': 'error', 'message': 'Redis not connected'}
        
        try:
            ping = self.redis_client.ping()
            info = self.redis_client.info()
            return {
                'status': 'ok',
                'connected': ping,
                'memory_used': info.get('used_memory_human', 'unknown'),
                'uptime': info.get('uptime_in_seconds', 0),
            }
        except Exception as e:
            return {'status': 'error', 'message': str(e)}

    async def reconnect(self):
        """Attempt to reconnect to Redis."""
        logger.info("Attempting to reconnect to Redis...")
        self._connect()
