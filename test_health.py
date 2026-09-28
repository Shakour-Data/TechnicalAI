import asyncio
from api.routes.health import health_check
from unittest.mock import Mock
import api.config

async def test_health():
    # Create a mock request object
    request = Mock()
    request.app.state.start_time = 1000.0
    request.app.state = Mock()

    # Mock settings
    api.config.settings = Mock()
    api.config.settings.app_name = 'TechnicalAI'
    api.config.settings.app_version = '1.0.0'

    try:
        result = await health_check(request)
        print('Health check successful!')
        print(f'Status: {result["status"]}')
        print(f'Service: {result["service"]}')
        print(f'Version: {result["version"]}')
        print(f'Uptime: {result["uptime_seconds"]}')
        print(f'Data sources: {result["data_sources"]}')
    except Exception as e:
        print(f'Error: {e}')
        import traceback
        traceback.print_exc()
    finally:
        api.config.settings = Mock()

asyncio.run(test_health())