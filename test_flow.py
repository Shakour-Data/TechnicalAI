import urllib.request, urllib.error, json, time

# Test 1: ml-predict health check
print('Test 1: /api/ml-predict health check')
try:
    req = urllib.request.Request('http://localhost:8000/api/v1/analysis/ml-predict')
    response = urllib.request.urlopen(req, timeout=3)
    data = json.loads(response.read().decode())
    print(f'  Status: {response.status}, Body: {data}')
except Exception as e:
    print(f'  Error: {e}')

# Test 2: POST time-series analysis
print('\nTest 2: POST /api/v1/analysis/time-series')
try:
    payload = json.dumps({
        'symbol': 'TEST',
        'horizon': 5,
        'mode': 'quick',
        'model_keys': ['rf', 'xgboost', 'lightgbm', 'gbr']
    }).encode()
    req = urllib.request.Request('http://localhost:8000/api/v1/analysis/time-series', data=payload, headers={'Content-Type': 'application/json'})
    response = urllib.request.urlopen(req, timeout=5)
    data = json.loads(response.read().decode())
    analysis_id = data.get('analysis_id')
    print(f'  Status: {response.status}, analysis_id: {analysis_id}')

    # Test 3: Poll for completion
    print('\nTest 3: Polling for completion')
    for i in range(12):
        time.sleep(2)
        try:
            poll_req = urllib.request.Request(f'http://localhost:8000/api/v1/analysis/{analysis_id}')
            poll_response = urllib.request.urlopen(poll_req, timeout=3)
            poll_data = json.loads(poll_response.read().decode())
            status = poll_data.get('status')
            print(f'  Poll {i+1}: {status}', end='')
            if status == 'completed':
                result = poll_data.get('result', {})
                ml_forecast = result.get('ml_forecast', {})
                models_used = ml_forecast.get('ml_model_used', '')
                forecasts = list(ml_forecast.get('forecasts', {}).keys())
                print(f' | Models: {models_used} | Forecast keys: {forecasts}')
                break
            elif status == 'failed':
                error = poll_data.get('error', 'Unknown error')
                print(f' | Error: {error}')
                break
            else:
                print()
        except Exception as e:
            print(f'  Poll {i+1}: error {e}', end='')
    else:
        print('  Timed out after 24 seconds')
except Exception as e:
    print(f'  Error: {e}')