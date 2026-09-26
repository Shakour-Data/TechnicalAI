from sklearn.linear_model import (
    LogisticRegression, Ridge, Lasso, ElasticNet, HuberRegressor,
    BayesianRidge, SGDClassifier, SGDRegressor, Perceptron, PassiveAggressiveClassifier, PassiveAggressiveRegressor
)
from sklearn.ensemble import (
    RandomForestClassifier, ExtraTreesClassifier,
    GradientBoostingClassifier, HistGradientBoostingClassifier,
    AdaBoostClassifier,
    RandomForestRegressor, ExtraTreesRegressor,
    GradientBoostingRegressor, HistGradientBoostingRegressor,
    VotingClassifier, VotingRegressor, StackingClassifier, StackingRegressor,
)
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.svm import SVC, SVR, LinearSVC
from sklearn.neural_network import MLPClassifier, MLPRegressor
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis
from sklearn.discriminant_analysis import QuadraticDiscriminantAnalysis
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import TimeSeriesSplit
import xgboost as xgb
import lightgbm as lgb
from catboost import CatBoostClassifier, CatBoostRegressor
from typing import Dict, Any, Optional, Tuple

# Classification model keys (14 base models + 3 online models)
CLASSIFICATION_MODELS = [
    "logistic_regression",
    "linear_svc",
    "lda",
    "qda",
    "random_forest_classifier",
    "extra_trees_classifier",
    "gradient_boosting_classifier",
    "hist_gradient_boosting_classifier",
    "xgb_classifier",
    "lightgbm_classifier",
    "catboost_classifier",
    "ada_boost_classifier",
    "k_neighbors_classifier",
    "svc",
    "mlp_classifier",
    # Online/incremental learning models
    "sgd_classifier",
    "perceptron",
    "passive_aggressive_classifier",
]

# Regression model keys (14 base models + 2 online models)
REGRESSION_MODELS = [
    "bayesian_ridge",
    "ridge",
    "lasso",
    "elastic_net",
    "huber_regressor",
    "random_forest_regressor",
    "extra_trees_regressor",
    "hist_gradient_boosting_regressor",
    "gradient_boosting_regressor",
    "xgb_regressor",
    "lightgbm_regressor",
    "catboost_regressor",
    "svr",
    "k_neighbors_regressor",
    "mlp_regressor",
    # Online/incremental learning models
    "sgd_regressor",
    "passive_aggressive_regressor",
]

# Ensemble models
ENSEMBLE_MODELS = [
    "voting_classifier",
    "voting_regressor",
    "stacking_classifier",
    "stacking_regressor",
]

# Baseline models
BASELINE_MODELS = [
    "naive_last",
    "drift",
    "rolling_mean",
    "seasonal_naive",
]

# All model types
ALL_MODEL_KEYS = CLASSIFICATION_MODELS + REGRESSION_MODELS + ENSEMBLE_MODELS + BASELINE_MODELS


def build_classification_model(model_key: str) -> Optional[Any]:
    """Build a classification model by key."""
    builders = {
        "logistic_regression": lambda: LogisticRegression(
             max_iter=1000, C=1.0, solver='lbfgs', random_state=42
         ),
        "linear_svc": lambda: LinearSVC(
            C=1.0, max_iter=2000, dual=False, random_state=42
        ),
        "lda": lambda: LinearDiscriminantAnalysis(),
        "qda": lambda: QuadraticDiscriminantAnalysis(),
        "random_forest_classifier": lambda: RandomForestClassifier(
            n_estimators=200, max_depth=8, min_samples_split=5,
            min_samples_leaf=2, random_state=42, n_jobs=-1
        ),
        "extra_trees_classifier": lambda: ExtraTreesClassifier(
            n_estimators=200, max_depth=8, min_samples_split=5,
            min_samples_leaf=2, random_state=42, n_jobs=-1
        ),
        "gradient_boosting_classifier": lambda: GradientBoostingClassifier(
            n_estimators=200, max_depth=4, learning_rate=0.05,
            subsample=0.8, max_features="sqrt", random_state=42
        ),
        "hist_gradient_boosting_classifier": lambda: HistGradientBoostingClassifier(
            max_iter=300, max_depth=6, learning_rate=0.05, random_state=42
        ),
        "xgb_classifier": lambda: xgb.XGBClassifier(
            n_estimators=200, max_depth=5, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8, use_label_encoder=False,
            eval_metric="logloss", verbosity=0, n_jobs=-1, random_state=42
        ),
        "lightgbm_classifier": lambda: lgb.LGBMClassifier(
            n_estimators=200, max_depth=6, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8, verbose=-1, n_jobs=-1, random_state=42
        ),
        "catboost_classifier": lambda: CatBoostClassifier(
            iterations=200, depth=6, learning_rate=0.05,
            subsample=0.8, random_seed=42, verbose=0,
            early_stopping_rounds=20
        ),
        "ada_boost_classifier": lambda: AdaBoostClassifier(
            n_estimators=200, learning_rate=0.05, random_state=42
        ),
        "k_neighbors_classifier": lambda: KNeighborsClassifier(n_neighbors=5),
        "svc": lambda: SVC(
            kernel='rbf', C=10.0, gamma='scale', probability=True, random_state=42
        ),
        "mlp_classifier": lambda: MLPClassifier(
            hidden_layer_sizes=(100, 50), max_iter=500, random_state=42, early_stopping=True
        ),
        # Online learning models
        "sgd_classifier": lambda: SGDClassifier(
            loss='log_loss', penalty='l2', alpha=0.0001,
            max_iter=1000, tol=1e-3, random_state=42, early_stopping=True
        ),
        "perceptron": lambda: Perceptron(
            max_iter=1000, eta0=0.01, random_state=42, shuffle=True
        ),
        "passive_aggressive_classifier": lambda: PassiveAggressiveClassifier(
            max_iter=1000, tol=1e-3, random_state=42, early_stopping=True
        ),
    }
    builder = builders.get(model_key)
    if builder is None:
        return None
    model = builder()
    if model_key in ("xgb_classifier", "lightgbm_classifier", "catboost_classifier"):
        return CalibratedClassifierCV(model, cv=3, method='isotonic')
    return model


def build_regression_model(model_key: str) -> Optional[Any]:
    """Build a regression model by key."""
    builders = {
        "bayesian_ridge": lambda: BayesianRidge(),
        "ridge": lambda: Ridge(alpha=1.0),
        "lasso": lambda: Lasso(alpha=1.0),
        "elastic_net": lambda: ElasticNet(alpha=1.0, l1_ratio=0.5),
        "huber_regressor": lambda: HuberRegressor(max_iter=200),
        "random_forest_regressor": lambda: RandomForestRegressor(
            n_estimators=200, max_depth=8, min_samples_split=5,
            min_samples_leaf=2, random_state=42, n_jobs=-1
        ),
        "extra_trees_regressor": lambda: ExtraTreesRegressor(
            n_estimators=200, max_depth=8, min_samples_split=5,
            min_samples_leaf=2, random_state=42, n_jobs=-1
        ),
        "hist_gradient_boosting_regressor": lambda: HistGradientBoostingRegressor(
            max_iter=300, max_depth=6, learning_rate=0.05, random_state=42
        ),
        "gradient_boosting_regressor": lambda: GradientBoostingRegressor(
            n_estimators=200, max_depth=4, learning_rate=0.05,
            subsample=0.8, max_features="sqrt", random_state=42
        ),
        "xgb_regressor": lambda: xgb.XGBRegressor(
            n_estimators=200, max_depth=5, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8, verbosity=0,
            n_jobs=-1, random_state=42
        ),
        "lightgbm_regressor": lambda: lgb.LGBMRegressor(
            n_estimators=200, max_depth=6, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8, verbose=-1, n_jobs=-1, random_state=42
        ),
        "catboost_regressor": lambda: CatBoostRegressor(
            iterations=200, depth=6, learning_rate=0.05,
            subsample=0.8, random_seed=42, verbose=0,
            early_stopping_rounds=20
        ),
        "svr": lambda: SVR(kernel='rbf', C=100.0, gamma='scale', epsilon=0.01),
        "k_neighbors_regressor": lambda: KNeighborsRegressor(n_neighbors=5),
        "mlp_regressor": lambda: MLPRegressor(
            hidden_layer_sizes=(100, 50), max_iter=500, random_state=42, early_stopping=True
        ),
        # Online learning models
        "sgd_regressor": lambda: SGDRegressor(
            loss='squared_error', penalty='l2', alpha=0.0001,
            max_iter=1000, tol=1e-3, random_state=42, early_stopping=True
        ),
        "passive_aggressive_regressor": lambda: PassiveAggressiveRegressor(
            max_iter=1000, tol=1e-3, random_state=42, early_stopping=True
        ),
    }
    builder = builders.get(model_key)
    if builder is None:
        return None
    return builder()


def build_ensemble_classifier() -> VotingClassifier:
    """Build a VotingClassifier ensemble."""
    estimators = [
        ('lr', LogisticRegression(max_iter=1000, C=1.0, random_state=42)),
        ('rf', RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42, n_jobs=-1)),
        ('xgb', xgb.XGBClassifier(n_estimators=100, max_depth=3, use_label_encoder=False, eval_metric='logloss', verbosity=0, random_state=42)),
        ('lgbm', lgb.LGBMClassifier(n_estimators=100, max_depth=3, verbose=-1, random_state=42)),
    ]
    return VotingClassifier(estimators=estimators, voting='soft')


def build_ensemble_regressor() -> VotingRegressor:
    """Build a VotingRegressor ensemble."""
    estimators = [
        ('br', BayesianRidge()),
        ('rf', RandomForestRegressor(n_estimators=100, max_depth=5, random_state=42, n_jobs=-1)),
        ('xgb', xgb.XGBRegressor(n_estimators=100, max_depth=3, verbosity=0, random_state=42)),
        ('lgbm', lgb.LGBMRegressor(n_estimators=100, max_depth=3, verbose=-1, random_state=42)),
    ]
    return VotingRegressor(estimators=estimators)


def build_stacking_classifier() -> StackingClassifier:
    """Build a StackingClassifier with Ridge meta-learner."""
    estimators = [
        ('lr', LogisticRegression(max_iter=1000, C=1.0, random_state=42)),
        ('rf', RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42, n_jobs=-1)),
        ('xgb', xgb.XGBClassifier(n_estimators=100, max_depth=3, use_label_encoder=False, eval_metric='logloss', verbosity=0, random_state=42)),
    ]
    return StackingClassifier(
        estimators=estimators,
        final_estimator=Ridge(),
        cv=TimeSeriesSplit(n_splits=3),
        stack_method='predict_proba'
    )


def build_stacking_regressor() -> StackingRegressor:
    """Build a StackingRegressor with Ridge meta-learner."""
    estimators = [
        ('lr', BayesianRidge()),
        ('rf', RandomForestRegressor(n_estimators=100, max_depth=5, random_state=42, n_jobs=-1)),
        ('xgb', xgb.XGBRegressor(n_estimators=100, max_depth=3, verbosity=0, random_state=42)),
    ]
    return StackingRegressor(
        estimators=estimators,
        final_estimator=Ridge(),
        cv=TimeSeriesSplit(n_splits=3)
    )


def get_model_builder(model_key: str) -> Optional[callable]:
    """Return the appropriate builder function for a model key."""
    if model_key in CLASSIFICATION_MODELS:
        return lambda: build_classification_model(model_key)
    elif model_key in REGRESSION_MODELS:
        return lambda: build_regression_model(model_key)
    elif model_key == 'voting_classifier':
        return build_ensemble_classifier
    elif model_key == 'voting_regressor':
        return build_ensemble_regressor
    elif model_key == 'stacking_classifier':
        return build_stacking_classifier
    elif model_key == 'stacking_regressor':
        return build_stacking_regressor
    return None