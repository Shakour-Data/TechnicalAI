"""
ML Prediction Service - Compatible with ML Trainer.

Provides prediction capabilities using models trained by ml-trainer.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
import json
import numpy as np


class MLPredictionService:
    """ML Prediction Service for time series forecasting."""
    
    def __init__(self, models_dir: str = "models"):
        self.models_dir = models_dir
        self.loaded_models: Dict[str, Any] = {}
    
    def load_model(self, symbol: str, model_name: str) -> bool:
        """Load a trained model for prediction."""
        # In production, load from pickle/ONNX files
        # For now, return success if metadata exists
        import os
        meta_path = os.path.join(self.models_dir, symbol, f"{model_name}.json")
        if os.path.exists(meta_path):
            with open(meta_path) as f:
                meta = json.load(f)
            self.loaded_models[f"{symbol}_{model_name}"] = meta
            return True
        return False
    
    def predict(
        self, 
        symbol: str, 
        model_name: str, 
        features: np.ndarray,
        horizon: int = 5
    ) -> Dict[str, Any]:
        """Make prediction using loaded model."""
        key = f"{symbol}_{model_name}"
        if key not in self.loaded_models:
            return {
                'status': 'error',
                'error': f'Model {model_name} not loaded for {symbol}'
            }
        
        meta = self.loaded_models[key]
        
        # Mock prediction
        predictions = []
        last_price = features[-1] if len(features) > 0 else 100
        
        for i in range(horizon):
            direction = np.random.choice(['up', 'down'], p=[0.55, 0.45])
            confidence = np.random.uniform(0.5, 0.9)
            
            pred = {
                'session': i + 1,
                'direction': direction,
                'confidence': float(confidence),
                'predicted_price': float(last_price * (1 + np.random.uniform(-0.01, 0.01))),
                'lower_bound': float(last_price * 0.98),
                'upper_bound': float(last_price * 1.02)
            }
            predictions.append(pred)
        
        return {
            'status': 'ok',
            'symbol': symbol,
            'model': model_name,
            'predictions': predictions,
            'horizon': horizon,
            'generated_at': datetime.now().isoformat()
        }
    
    def health_check(self) -> Dict[str, Any]:
        """Health check endpoint."""
        return {
            'status': 'healthy',
            'service': 'ml-prediction-service',
            'loaded_models': len(self.loaded_models),
            'timestamp': datetime.now().isoformat()
        }


# Global service instance
prediction_service = MLPredictionService()


def get_service() -> MLPredictionService:
    """Get the global prediction service instance."""
    return prediction_service


# ────────────────────────────────────────────────────────────────────────────
# API-compatible functions
# ────────────────────────────────────────────────────────────────────────────

def predict_price(
    symbol: str,
    model_name: str,
    ohlcv_data: List[List],
    horizon: int = 5
) -> Dict[str, Any]:
    """
    API-compatible prediction function.
    
    Args:
        symbol: Trading symbol
        model_name: Model to use
        ohlcv_data: OHLCV data as list of lists
        horizon: Prediction horizon
    
    Returns:
        Prediction result
    """
    # Load model
    if not prediction_service.load_model(symbol, model_name):
        return {
            'status': 'error',
            'error': f'Model {model_name} not found for {symbol}'
        }
    
    # Extract features (simplified)
    if len(ohlcv_data) > 0:
        last_close = ohlcv_data[-1][4]  # close price
        features = np.array([last_close])
    else:
        features = np.array([100.0])
    
    return prediction_service.predict(symbol, model_name, features, horizon)


def get_model_metadata(symbol: str, model_name: str) -> Optional[Dict[str, Any]]:
    """Get model metadata."""
    key = f"{symbol}_{model_name}"
    if key in prediction_service.loaded_models:
        return prediction_service.loaded_models[key]
    return None


def list_models(symbol: str) -> List[str]:
    """List available models for a symbol."""
    import os
    model_dir = os.path.join(prediction_service.models_dir, symbol)
    if not os.path.exists(model_dir):
        return []
    return [f.replace('.json', '') for f in os.listdir(model_dir) if f.endswith('.json')]


# ────────────────────────────────────────────────────────────────────────────
# FastAPI app (optional)
# ────────────────────────────────────────────────────────────────────────────

try:
    from fastapi import FastAPI, HTTPException
    from pydantic import BaseModel
    from typing import Optional
    
    app = FastAPI(title="ML Prediction Service", version="1.0.0")
    
    class PredictionRequest(BaseModel):
        symbol: str
        model_name: str
        ohlcv_data: List[List]
        horizon: int = 5
    
    class PredictionResponse(BaseModel):
        status: str
        symbol: str
        model: str
        predictions: List[Dict[str, Any]]
        horizon: int
        generated_at: str
        error: Optional[str] = None
    
    @app.post("/predict", response_model=PredictionResponse)
    async def api_predict(request: PredictionRequest):
        """API endpoint for predictions."""
        result = predict_price(
            request.symbol,
            request.model_name,
            request.ohlcv_data,
            request.horizon
        )
        return result
    
    @app.get("/health")
    async def api_health():
        """Health check endpoint."""
        return prediction_service.health_check()
    
    @app.get("/models/{symbol}")
    async def api_list_models(symbol: str):
        """List models for a symbol."""
        return {'models': list_models(symbol)}
    
    @app.get("/models/{symbol}/{model_name}")
    async def api_model_metadata(symbol: str, model_name: str):
        """Get model metadata."""
        meta = get_model_metadata(symbol, model_name)
        if meta is None:
            raise HTTPException(status_code=404, detail="Model not found")
        return meta
    
    print("ML Prediction Service FastAPI app created")
    
except ImportError:
    # FastAPI not available, skip
    app = None
    print("FastAPI not installed, skipping API creation")


# ────────────────────────────────────────────────────────────────────────────
# Main
# ────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Test the service
    print("ML Prediction Service")
    print("=" * 40)
    print("Available functions:")
    print("  - predict_price(symbol, model_name, ohlcv_data, horizon)")
    print("  - get_model_metadata(symbol, model_name)")
    print("  - list_models(symbol)")
    print("  - prediction_service.health_check()")