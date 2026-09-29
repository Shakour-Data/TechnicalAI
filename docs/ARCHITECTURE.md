# TechnicalAI Architecture Decision Records

## ADR 001: 37-Feature VDSS Limit

**Status:** Accepted  
**Context:** Phase 0.0 requires establishing the foundational infrastructure before any phase can proceed. The 37-feature VDSS limit is a critical foundation decision that must be settled before any phase.

**Decision:** The TechnicalAI system will use exactly 37 features for the Volatility-Direction-Strength-Structure (VDSS) feature set, composed as follows:
- 16 VDSS raw score features (f_rsi, f_mfi, f_cci, s_adx, f_macd, f_stoch, s_bb, s_ma21, s_ma100, s_ema, s_atr, s_trend, s_sr, f_stoch_cross, f_macd_cross, f_div)
- 12 distance features (normalized price distances to key levels: R1, S1, MA100, trend lines, S/R zones)
- 4 edge probability features (up, down, pullback, risk — computed from decision graph edge weights)
- 3 group path contributions (simple average of path contributions across 3 branches: trend, breakout, reversal)
- 1 regime feature (current market regime: bull/bear/neutral/volatile — from Phase 2 regime engine)
- 1 pattern feature (detected candlestick pattern: doji, hammer, shooting star, engulfing)

**Consequences:**
- Any new features must explicitly replace existing ones (see Phase 2 Task 2.5 replacement mapping)
- Feature extraction functions must validate exactly 37 features are returned
- All downstream phases must use this exact feature set

**References:** phase_0.0_prompt.txt lines 8-15

---

## ADR 002: Scenario Label Definition (FINAL)

**Status:** Accepted  
**Context:** Phase 0.5 Task 0.3 established the final scenario thresholds that must be used by all phases as the single source of truth.

**Decision:** All phases MUST use the exact SC1-SC9 thresholds defined in Phase 0.5 Task 0.3:
- SC1: < -10% (Bearish Shock)
- SC2: -10% to -5% (Accelerating Bear)
- SC3: -5% to -2% (Strong Bear)
- SC4: -2% to -0.5% (Weak Bear)
- SC5: -0.5% to +0.5% (Range-bound)
- SC6: +0.5% to +2% (Weak Bull)
- SC7: +2% to +5% (Strong Bull)
- SC8: +5% to +10% (Accelerating Bull)
- SC9: > +10% (Bullish Shock)

**Consequences:**
- Any downstream phase using different thresholds is incorrect
- Scenario labeling functions must implement these exact thresholds
- Unit tests must validate against these thresholds

**References:** phase_0.0_prompt.txt lines 16-26

---

## ADR 003: Ensemble Weighting Method

**Status:** Accepted  
**Context:** Phase 0.5 CRITICAL DESIGN DECISION #10 established the ensemble weighting method.

**Decision:** The TechnicalAI system will use inverse-variance weighting based on out-of-sample performance for ensemble modeling.

**Consequences:**
- This is the ONLY acceptable method for ensemble weighting
- Model performance metrics must be tracked for variance calculation
- Implementation must handle cases where variance is zero or near-zero

**References:** phase_0.0_prompt.txt line 27

---

## ADR 004: Path Contribution Aggregation

**Status:** Accepted  
**Context:** Phase 0.5 CRITICAL DESIGN DECISION #11 established the path contribution aggregation method.

**Decision:** The TechnicalAI system will use simple average of 3 branch path contributions per scenario.

**Consequences:**
- This is the ONLY acceptable method for path contribution aggregation
- The three branches are: trend, breakout, reversal
- Simple arithmetic mean will be used (not weighted or geometric)

**References:** phase_0.0_prompt.txt line 29

---

## ADR 005: No-Prohibition Rules

**Status:** Accepted  
**Context:** Phase 0.5 Notes established specific prohibitions to prevent certain approaches that are incompatible with the TechnicalAI methodology.

**Decision:** The TechnicalAI system MUST NOT use:
- Prophet, N-BEATS, TFT, or deep learning models
- SMOTE or ADASYN for time series
- Autoencoders (explicitly prohibited in Phase 3 Task 3.3)
- Temperature scaling for tree-based models (explicitly prohibited in Phase 3 Task 3.4)
- BCa with block stationary bootstrap (explicitly prohibited in Phase 4 Task 4.3)
- Kalman filter except for local linear trend only (explicitly required in Phase 2 Task 2.2)

**Consequences:**
- Only scikit-learn, statsmodels, ruptures, lightgbm are permitted for ML
- Walk-forward validation must be used exclusively
- Data leakage must be prevented at all costs

**References:** phase_0.0_prompt.txt lines 31-41

---

## ADR 006: Technology Stack Choices

**Status:** Accepted  
**Context:** Phase 0.0 requires establishing the foundational infrastructure.

**Decision:** 
- Backend: FastAPI with Python 3.11+, SQLAlchemy 2.0+, Alembic for migrations
- Frontend: Next.js 16+ with TypeScript, Tailwind CSS 4
- Database: PostgreSQL 13+ (using SQLite for development with plan to migrate to PostgreSQL)
- Caching: Redis for job queuing (optional)
- Testing: pytest for Python, Jest for TypeScript (via Next.js testing utilities)
- CI/CD: GitHub Actions with Docker containerization
- Monitoring: Prometheus metrics endpoint

**Consequences:**
- All Python code must follow PEP 8 and use type hints where beneficial
- All TypeScript code must follow strict typing
- Dockerfiles must be provided for both backend and frontend
- Environment configuration must be managed through .env files

**References:** phase_0.0_prompt.txt sections 44-59, 109-135

---

## ADR 007: Data Leakage Prevention

**Status:** Accepted  
**Context:** Phase 0.5 Notes explicitly prohibit data leakage at all costs.

**Decision:** The TechnicalAI system will use walk-forward validation exclusively and implement strict temporal separation in all machine learning pipelines.

**Consequences:**
- No random shuffling of time series data
- No use of future data to predict past values
- All training/validation splits must respect temporal order
- Features must be computed only using historical data available at prediction time

**References:** phase_0.0_prompt.txt line 36

## Summary

This document captures the key architectural decisions made during Phase 0.0 of the TechnicalAI project. These decisions establish the foundation upon which all subsequent phases (0.5 through 6.0) will build.

**To implement:** 
1. All code must comply with these decisions
2. New features must go through the ADR process if they affect these decisions
3. These documents should be reviewed and updated as the project evolves