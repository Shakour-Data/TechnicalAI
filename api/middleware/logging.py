from fastapi import Request, Response
import logging
import time
import json
from datetime import datetime, timezone
from typing import Dict, Any

logger = logging.getLogger(__name__)

class LoggingMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            await self.app(scope, receive, send)
            return

        request_time = time.time()
        path = scope.get('path', '')
        method = scope.get('method', '')
        query_string = scope.get('query_string', b'')
        client_host = scope.get('client', [''])[0]
        user_agent = scope.get('headers', [])

        # Extract user agent
        user_agent_str = 'Unknown'
        for key, value in user_agent:
            if key.decode() == 'user-agent':
                user_agent_str = value.decode('utf-8', errors='ignore')
                break

        # Process request
        response_started = False

        async def send_wrapper(message):
            nonlocal response_started
            if message['type'] == 'http.response.start':
                response_started = True
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception as e:
            logger.error(f"Request {method} {path} failed: {e}")
            raise
        finally:
            if response_started:
                request_duration = time.time() - request_time

                # Log request details
                log_data = {
                    'timestamp': datetime.now(timezone.utc).isoformat()[:-3] + 'Z',
                    'method': method,
                    'path': path,
                    'query': query_string.decode('utf-8', errors='ignore'),
                    'duration_ms': round(request_duration * 1000, 2),
                    'client_ip': client_host,
                    'user_agent': user_agent_str,
                }

                logger.info(json.dumps(log_data, ensure_ascii=False))

                # Increment metrics
                try:
                    from api.main import REQUEST_COUNT, REQUEST_DURATION, ERROR_COUNT
                    endpoint = path.split('/')[-1] if path.count('/') > 2 else path
                    status = '200'  # Default success
                    REQUEST_COUNT.labels(method=method, endpoint=endpoint, status=status).inc()
                    REQUEST_DURATION.observe(request_duration)
                except:
                    pass
