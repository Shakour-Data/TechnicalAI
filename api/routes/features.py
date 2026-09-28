"""Feature extraction and scenario labeling routes."""
import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from api.services.ml_models import (
    VDSS_FEATURE_NAMES,
    extract_all_37_features,
    get_scenario_label,
    get_scenario_thresholds,
    label_scenario,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Features"])


class FeatureExtractRequest(BaseModel):
    """Request body for feature extraction."""
    data: list[dict[str, float]] = Field(
        ...,
        description="OHLCV data array with open, high, low, close, volume fields",
        min_length=100,
    )
    end_index: int = Field(
        default=-1,
        description="Index of the data point to extract features for (default: last element)",
    )
    has_volume: bool = Field(
        default=True,
        description="Whether the data contains volume information",
    )


class FeatureExtractResponse(BaseModel):
    """Response body for feature extraction."""
    feature_count: int
    feature_names: list[str]
    features: dict[str, float]
    raw_features: list[float]


class ScenarioLabelRequest(BaseModel):
    """Request body for scenario labeling."""
    return_pct: float = Field(
        ...,
        description="Return percentage as decimal (e.g., 0.05 for 5%)",
    )


class ScenarioLabelResponse(BaseModel):
    """Response body for scenario labeling."""
    scenario_code: str
    scenario_label: str
    return_pct: float
    thresholds: list[dict[str, Any]]


@router.post("/features/extract", response_model=FeatureExtractResponse)
async def extract_features(request: FeatureExtractRequest):
    """
    Extract exactly 37 VDSS features from OHLCV data.
    
    Returns:
        37 features including:
        - 16 raw VDSS score features
        - 12 distance features
        - 4 edge probability features
        - 3 group path contributions
        - 1 regime feature
        - 1 pattern feature
    """
    try:
        end_idx = request.end_index if request.end_index >= 0 else len(request.data) - 1
        
        if end_idx >= len(request.data) or end_idx < 0:
            raise HTTPException(status_code=400, detail="Invalid end_index")
        
        features = extract_all_37_features(request.data, end_idx, request.has_volume)
        
        features_dict = {name: round(value, 6) for name, value in zip(VDSS_FEATURE_NAMES, features)}
        
        return FeatureExtractResponse(
            feature_count=len(features),
            feature_names=VDSS_FEATURE_NAMES,
            features=features_dict,
            raw_features=[round(f, 6) for f in features],
        )
    except (ValueError, KeyError, IndexError) as e:
        logger.error(f"Feature extraction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Feature extraction failed: {e!s}")


@router.get("/features/names", response_model=dict[str, Any])
async def get_feature_names():
    """
    Get the list of 37 VDSS feature names.
    
    Returns:
        List of 37 feature names with their category breakdown
    """
    return {
        "feature_count": len(VDSS_FEATURE_NAMES),
        "feature_names": VDSS_FEATURE_NAMES,
        "categories": {
            "raw_scores": VDSS_FEATURE_NAMES[:16],
            "distance_features": VDSS_FEATURE_NAMES[16:28],
            "edge_probability": VDSS_FEATURE_NAMES[28:32],
            "group_path_contributions": VDSS_FEATURE_NAMES[32:35],
            "regime": [VDSS_FEATURE_NAMES[35]],
            "pattern": [VDSS_FEATURE_NAMES[36]],
        },
    }


@router.post("/labels/scenario", response_model=ScenarioLabelResponse)
async def label_scenario_endpoint(request: ScenarioLabelRequest):
    """
    Label a return percentage with the correct scenario SC1-SC9.
    
    Uses the final thresholds from Phase 0.5 Task 0.3.
    """
    try:
        scenario_code = label_scenario(request.return_pct)
        scenario_label = get_scenario_label(scenario_code)
        thresholds = get_scenario_thresholds()
        
        return ScenarioLabelResponse(
            scenario_code=scenario_code,
            scenario_label=scenario_label,
            return_pct=request.return_pct,
            thresholds=thresholds,
        )
    except Exception as e:
        logger.error(f"Scenario labeling failed: {e}")
        raise HTTPException(status_code=500, detail=f"Scenario labeling failed: {e!s}")


@router.get("/labels/scenarios", response_model=dict[str, Any])
async def get_scenarios():
    """
    Get all scenario labels and their thresholds.
    
    Returns:
        Dictionary with all 9 scenario codes, labels, and threshold ranges
    """
    return {
        "scenarios": get_scenario_thresholds(),
        "labels": get_scenario_label,
    }