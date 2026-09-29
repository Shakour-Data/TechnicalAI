import requests
import time

# Test ml-predict
print('Testing ml-predict:')
resp = requests.get('http://localhost:8000/ml-predict')
print(f'Status: {resp.status_code}')
print(f'Response: {resp.json() if resp.status_code == 200 else resp.text[:200]}')

# Test time-series analysis
print('\nTesting time-series analysis:')
payload = {
    'symbol': 'TEST',
    'horizon': 5,
    'mode': 'quick',
    'model_keys': ['rf', 'xgboost', 'lightgbm', 'gbr']
}

resp = requests.post('http://localhost:8000/api/v1/analysis/time-series', json=payload)
print(f'Status: {resp.status_code}')
print(f'Response: {resp.json() if resp.status_code == 200 else resp.text[:200]}')

if resp.status_code == 200:
    analysis_id = resp.json().get('analysis_id')
    if analysis_id:
        print(f'\nPolling analysis {analysis_id}...')
        for i in range(12):
            poll_resp = requests.get(f'http://localhost:8000/api/v1/analysis/{analysis_id}')
            poll_data = poll_resp.json()
            print(f'  Poll {i+1}: {poll_data.get("status")}')
            if poll_data.get('status') == 'completed':
                result = poll_data.get('result', {})
                ml_forecast = result.get('ml_forecast', {})
                if ml_forecast:
                    print(f'    Models: {ml_forecast.get("ml_model_used")}')
                    print(f'    Forecast keys: {list(ml_forecast.get("forecasts", {}).keys())}')
                    print(f'    Models count: {len(ml_forecast.get("forecasts", {}))}')
                    print(f'    Features count: {ml_forecast.get("features_count", "N/A")}')
                    print(f'    Models count: {ml_forecast.get("models_count", "N/A")}')
                break
            time.sleep(2)
else:
    print('Failed to start analysis')