"""
Model catalog for ML Trainer.

Provides factory functions to build various classification and regression models
from scikit-learn. Each model type can be built independently with default
hyperparameters.

CLASSIFICATION_MODELS: 22 classification model keys
REGRESSION_MODELS: 22 regression model keys  
ENSEMBLE_MODELS: 6 ensemble model keys
"""

from typing import Any, Dict, Optional, List
import numpy as np
from sklearn.linear_model import LogisticRegression, LinearRegression, Ridge, Lasso, \
    ElasticNet, HuberRegressor, BayesianRidge, SGDClassifier, SGDRegressor, QuantileRegressor, \
    TheilSenRegressor, RANSACRegressor
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor, RadiusNeighborsClassifier, RadiusNeighborsRegressor
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.ensemble import (RandomForestClassifier, RandomForestRegressor,
                               GradientBoostingClassifier, GradientBoostingRegressor,
                               AdaBoostClassifier, AdaBoostRegressor,
                               BaggingClassifier, BaggingRegressor,
                               ExtraTreesClassifier, ExtraTreesRegressor,
                               VotingClassifier, VotingRegressor)
from sklearn.naive_bayes import GaussianNB, MultinomialNB, BernoulliNB, CategoricalNB, ComplementNB
from sklearn.svm import SVC, NuSVC, SVR
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis, QuadraticDiscriminantAnalysis
from sklearn.neural_network import MLPClassifier, MLPRegressor
from sklearn.preprocessing import PolynomialFeatures
from sklearn.pipeline import Pipeline
from sklearn.utils import check_random_state
import sklearn.utils

# XGBoost and LightGBM
from xgboost import XGBClassifier, XGBRegressor
from lightgbm import LGBMClassifier, LGBMRegressor

# Time series models
from statsmodels.tsa.arima.model import ARIMA


CLASSIFICATION_MODELS: List[str] = [
    "random_forest_classifier", "gradient_boosting_classifier", "logistic_regression",
    "svm_classifier", "decision_tree_classifier", "knn_classifier", 
    "neural_network_classifier", "naive_bayes_classifier", 
    "xgboost_classifier", "lightgbm_classifier", "adaboost_classifier",
    "bagging_classifier", "extra_trees_classifier", "radius_neighbors_classifier",
    "gaussian_naive_bayes", "bernoulli_nb", "complement_nb", 
    "quadratic_discriminant_analysis", "lda_classifier", "qda_classifier", 
    "mlp_classifier"
]

REGRESSION_MODELS: List[str] = [
    "random_forest_regressor", "gradient_boosting_regressor", "linear_regression",
    "svm_regressor", "decision_tree_regressor", "knn_regressor", 
    "neural_network_regressor", "arima_regressor", 
    "xgboost_regressor", "lightgbm_regressor", "adaboost_regressor",
    "bagging_regressor", "extra_trees_regressor", "ransac_regressor",
    "huber_regressor", "quantile_regressor", "theil_sen_regressor",
    "elastic_net", "lasso_regression", "ridge_regression", 
    "bayesian_ridge"
]

ENSEMBLE_MODELS: List[str] = [
    "voting_classifier", "voting_regressor",
    "stacking_classifier", "stacking_regressor",
    "bagging_classifier", "bagging_regressor"
]


class ModelInfo:
    """Wrapper for model with metadata."""
    
    def __init__(self, model: Any, name: str, model_type: str = "classification"):
        self.model = model
        self.name = name
        self.model_type = model_type
        self.trained = False
        self.fit_history = []
    
    def fit(self, X: Any, y: Any, **kwargs) -> Dict[str, Any]:
        """Fit model and return training info."""
        try:
            self.model.fit(X, y)
            self.trained = True
            return {
                'status': 'ok',
                'name': self.name,
                'model_type': self.model_type,
                'trained': True
            }
        except Exception as e:
            self.trained = False
            return {
                'status': 'error',
                'name': self.name,
                'model_type': self.model_type,
                'error': str(e)
            }
    
    def predict(self, X: Any) -> Any:
        """Predict with trained model."""
        if not self.trained:
            raise ValueError(f"Model {self.name} not trained")
        return self.model.predict(X)
    
    def predict_proba(self, X: Any) -> Any:
        """Predict probabilities (classification only)."""
        if not self.trained:
            raise ValueError(f"Model {self.name} not trained")
        if hasattr(self.model, 'predict_proba'):
            return self.model.predict_proba(X)
        return None
    
    def score(self, X: Any, y: Any) -> float:
        """Return model score (accuracy or r2)."""
        if not self.trained:
            raise ValueError(f"Model {self.name} not trained")
        return float(self.model.score(X, y))


def build_classification_model(model_key: str) -> ModelInfo:
    """
    Build a classification model by key.
    
    Args:
        model_key: One of CLASSIFICATION_MODELS
    
    Returns:
        ModelInfo wrapper with initialized model
    """
    model_map = {
        "random_forest_classifier": ModelInfo(
            RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1), 
            "random_forest_classifier"
        ),
        "gradient_boosting_classifier": ModelInfo(
            GradientBoostingClassifier(n_estimators=100, random_state=42), 
            "gradient_boosting_classifier"
        ),
        "logistic_regression": ModelInfo(
            LogisticRegression(C=1.0, max_iter=1000, random_state=42), 
            "logistic_regression"
        ),
        "svm_classifier": ModelInfo(
            SVC(C=1.0, kernel='rbf', probability=True, random_state=42), 
            "svm_classifier"
        ),
        "decision_tree_classifier": ModelInfo(
            DecisionTreeClassifier(max_depth=5, random_state=42), 
            "decision_tree_classifier"
        ),
        "knn_classifier": ModelInfo(
            KNeighborsClassifier(n_neighbors=5), 
            "knn_classifier"
        ),
        "neural_network_classifier": ModelInfo(
            MLPClassifier(hidden_layer_sizes=(100,), max_iter=500, random_state=42), 
            "neural_network_classifier"
        ),
        "naive_bayes_classifier": ModelInfo(
            GaussianNB(), 
            "naive_bayes_classifier"
        ),
        "xgboost_classifier": ModelInfo(
            XGBClassifier(n_estimators=100, eval_metric='logloss', random_state=42, 
                         use_label_encoder=False), 
            "xgboost_classifier"
        ),
        "lightgbm_classifier": ModelInfo(
            LGBMClassifier(n_estimators=100, random_state=42, verbose=-1), 
            "lightgbm_classifier"
        ),
        "adaboost_classifier": ModelInfo(
            AdaBoostClassifier(n_estimators=50, random_state=42), 
            "adaboost_classifier"
        ),
        "bagging_classifier": ModelInfo(
            BaggingClassifier(n_estimators=10, random_state=42), 
            "bagging_classifier"
        ),
        "extra_trees_classifier": ModelInfo(
            ExtraTreesClassifier(n_estimators=100, random_state=42, n_jobs=-1), 
            "extra_trees_classifier"
        ),
        "radius_neighbors_classifier": ModelInfo(
            RadiusNeighborsClassifier(radius=1.0), 
            "radius_neighbors_classifier"
        ),
        "gaussian_naive_bayes": ModelInfo(
            GaussianNB(), 
            "gaussian_naive_bayes"
        ),
        "bernoulli_nb": ModelInfo(
            BernoulliNB(), 
            "bernoulli_nb"
        ),
        "complement_nb": ModelInfo(
            ComplementNB(), 
            "complement_nb"
        ),
        "quadratic_discriminant_analysis": ModelInfo(
            QuadraticDiscriminantAnalysis(), 
            "quadratic_discriminant_analysis"
        ),
        "lda_classifier": ModelInfo(
            LinearDiscriminantAnalysis(), 
            "lda_classifier"
        ),
        "qda_classifier": ModelInfo(
            QuadraticDiscriminantAnalysis(), 
            "qda_classifier"
        ),
        "mlp_classifier": ModelInfo(
            MLPClassifier(hidden_layer_sizes=(50,), max_iter=500, random_state=42), 
            "mlp_classifier"
        ),
    }
    
    # Special handling for models that need explicit creation
    if model_key == "knn_classifier":
        model_map[model_key] = ModelInfo(
            KNeighborsClassifier(n_neighbors=5), 
            "knn_classifier"
        )
    
    return model_map.get(model_key, None)


def build_regression_model(model_key: str) -> ModelInfo:
    """
    Build a regression model by key.
    
    Args:
        model_key: One of REGRESSION_MODELS
    
    Returns:
        ModelInfo wrapper with initialized model
    """
    model_map = {
        "random_forest_regressor": ModelInfo(
            RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1), 
            "random_forest_regressor"
        ),
        "gradient_boosting_regressor": ModelInfo(
            GradientBoostingRegressor(n_estimators=100, random_state=42), 
            "gradient_boosting_regressor"
        ),
        "linear_regression": ModelInfo(
            LinearRegression(), 
            "linear_regression"
        ),
        "svm_regressor": ModelInfo(
            SVR(C=1.0, kernel='rbf'), 
            "svm_regressor"
        ),
        "decision_tree_regressor": ModelInfo(
            DecisionTreeRegressor(max_depth=5, random_state=42), 
            "decision_tree_regressor"
        ),
        "knn_regressor": ModelInfo(
            KNeighborsRegressor(n_neighbors=5), 
            "knn_regressor"
        ),
        "neural_network_regressor": ModelInfo(
            MLPRegressor(hidden_layer_sizes=(100,), max_iter=500, random_state=42), 
            "neural_network_regressor"
        ),
        "xgboost_regressor": ModelInfo(
            XGBRegressor(n_estimators=100, eval_metric='rmse', random_state=42, 
                        use_label_encoder=False), 
            "xgboost_regressor"
        ),
        "lightgbm_regressor": ModelInfo(
            LGBMRegressor(n_estimators=100, random_state=42, verbose=-1), 
            "lightgbm_regressor"
        ),
        "adaboost_regressor": ModelInfo(
            AdaBoostRegressor(n_estimators=50, random_state=42), 
            "adaboost_regressor"
        ),
        "bagging_regressor": ModelInfo(
            BaggingRegressor(n_estimators=10, random_state=42), 
            "bagging_regressor"
        ),
        "extra_trees_regressor": ModelInfo(
            ExtraTreesRegressor(n_estimators=100, random_state=42, n_jobs=-1), 
            "extra_trees_regressor"
        ),
        "lasso_regression": ModelInfo(
            Lasso(alpha=0.1, random_state=42, max_iter=1000), 
            "lasso_regression"
        ),
        "ridge_regression": ModelInfo(
            Ridge(alpha=1.0, random_state=42), 
            "ridge_regression"
        ),
        "elastic_net": ModelInfo(
            ElasticNet(alpha=0.1, l1_ratio=0.5, random_state=42, max_iter=1000), 
            "elastic_net"
        ),
        "bayesian_ridge": ModelInfo(
            BayesianRidge(), 
            "bayesian_ridge"
        ),
        "huber_regressor": ModelInfo(
            HuberRegressor(epsilon=1.35), 
            "huber_regressor"
        ),
        "quantile_regressor": ModelInfo(
            QuantileRegressor(quantile=0.5), 
            "quantile_regressor"
        ),
        "theil_sen_regressor": ModelInfo(
            TheilSenRegressor(random_state=42), 
            "theil_sen_regressor"
        ),
        "ransac_regressor": ModelInfo(
            RANSACRegressor(random_state=42), 
            "ransac_regressor"
        ),
        "arima_regressor": ModelInfo(
            ARIMA(np.array([1.0]), order=(0, 0, 0)), 
            "arima_regressor"
        ),
    }
    
    return model_map.get(model_key, None)


def build_ensemble_model(model_key: str) -> ModelInfo:
    """
    Build an ensemble model by key.
    
    Args:
        model_key: One of ENSEMBLE_MODELS
    
    Returns:
        ModelInfo wrapper with initialized ensemble model
    """
    model_map = {
        "voting_classifier": ModelInfo(
            VotingClassifier(estimators=[
                ('rf', RandomForestClassifier(n_estimators=50, random_state=42)),
                ('lr', LogisticRegression(random_state=42)),
                ('nb', GaussianNB())
            ], voting='soft'), 
            "voting_classifier"
        ),
        "voting_regressor": ModelInfo(
            VotingRegressor(estimators=[
                ('rf', RandomForestRegressor(n_estimators=50, random_state=42)),
                ('lr', LinearRegression())
            ]), 
            "voting_regressor"
        ),
        "bagging_classifier": ModelInfo(
            BaggingClassifier(n_estimators=10, random_state=42), 
            "bagging_classifier"
        ),
        "bagging_regressor": ModelInfo(
            BaggingRegressor(n_estimators=10, random_state=42), 
            "bagging_regressor"
        ),
    }
    
    # Handle stacking
    if model_key == "stacking_classifier":
        from sklearn.ensemble import StackingClassifier
        model_map[model_key] = ModelInfo(
            StackingClassifier(
                estimators=[
                    ('rf', RandomForestClassifier(n_estimators=50, random_state=42)),
                    ('lr', LogisticRegression(random_state=42))
                ],
                final_estimator=LogisticRegression(random_state=42)
            ), 
            "stacking_classifier"
        )
    
    if model_key == "stacking_regressor":
        from sklearn.ensemble import StackingRegressor
        model_map[model_key] = ModelInfo(
            StackingRegressor(
                estimators=[
                    ('rf', RandomForestRegressor(n_estimators=50, random_state=42)),
                    ('lr', LinearRegression())
                ],
                final_estimator=LinearRegression()
            ), 
            "stacking_regressor"
        )
    
    return model_map.get(model_key, None)


def build_ensemble_classifier() -> ModelInfo:
    """Build default ensemble classifier."""
    return build_ensemble_model("voting_classifier")


def build_ensemble_regressor() -> ModelInfo:
    """Build default ensemble regressor."""
    return build_ensemble_model("voting_regressor")


def build_stacking_classifier() -> ModelInfo:
    """Build stacking classifier."""
    return build_ensemble_model("stacking_classifier")


def build_stacking_regressor() -> ModelInfo:
    """Build stacking regressor."""
    return build_ensemble_model("stacking_regressor")


def get_model_keys_by_type(model_type: str) -> List[str]:
    """
    Get all model keys for a given type.
    
    Args:
        model_type: 'classification', 'regression', or 'ensemble'
    
    Returns:
        List of model keys
    """
    if model_type == "classification":
        return CLASSIFICATION_MODELS.copy()
    elif model_type == "regression":
        return REGRESSION_MODELS.copy()
    elif model_type == "ensemble":
        return ENSEMBLE_MODELS.copy()
    else:
        raise ValueError(f"Unknown model_type: {model_type}")


def count_models_by_type(model_type: str) -> Dict[str, int]:
    """
    Count models available by type.
    
    Args:
        model_type: 'classification', 'regression', or 'ensemble'
    
    Returns:
        Dict with counts and model keys
    """
    if model_type == "classification":
        keys = CLASSIFICATION_MODELS
    elif model_type == "regression":
        keys = REGRESSION_MODELS
    elif model_type == "ensemble":
        keys = ENSEMBLE_MODELS
    else:
        raise ValueError(f"Unknown model_type: {model_type}")
    
    return {
        'count': len(keys),
        'keys': keys
    }