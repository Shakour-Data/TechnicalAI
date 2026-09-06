---
Task ID: 1-5
Agent: Main
Task: Implement 5 algorithmic replacements without external hardware (GNN→Rule-based, HMM→Markov, Transformer→Weighted Voting, Volume Profile+Touch Count, MSL Feedback)

Work Log:
- Explored codebase structure: found 48 .ts files in src/lib/, 11 .tsx files in src/components/tse/
- Identified that GNN, HMM, Transformer only existed as spec references, not in code
- fetchMLRegime() was a dead stub calling an external Python service on port 3032
- SR analysis existed in sr-analyzer.ts (691 lines) with basic touch count and volume
- composite-scores.ts had basic calcTrendStrength and calcSRStrength functions
- MSL v4 had 5-state RegimeType but only simple heuristic mapping

- Created regime-engine.ts (items #1, #2, #3):
  - fuzzyRegimeDetector(): fuzzy logic with trimf/trapmf on ADX, RSI, BB, DI, EMA slope, ATR
  - calculateTrendStrengthRB(): rule-based trend strength (ADX + slope + BB)
  - 5-state Markov Chain: TRENDING_UP, TRENDING_DOWN, RANGING, VOLATILE, BREAKOUT
  - createMarkovChain(), updateRegimeTransition(), propagateMarkov(), getMarkovRegime()
  - indicatorSignals(): generates -1/0/+1 for MACD, Stoch, RSI, OBV, MFI, ADX, BB
  - adaptiveWeightedVote(): combines indicator signals with adaptive weights
  - decayWeightsFromError(): penalizes wrong indicators (rate 0.05)
  - detectRegime(): unified entry point combining all 3 methods (0.5 Markov + 0.3 fuzzy + 0.2 vote)
  - toMSLRegime(): compatibility mapping to MSL v4 RegimeType

- Created volume-profile.ts (item #4):
  - approximateVolumeProfile(): distributes OHLCV volume across N bins using body/wick weighting
  - countTouch(): counts High/Low touches within tolerance% of S/R level
  - volumeAtLevel(): bilinear interpolation of volume profile at price
  - calculateEnhancedSRStrength(): combines touch count + VP concentration + distance + freshness

- Created msl-feedback.ts (item #5):
  - FeedbackStore class: stores predictions + feedback in memory + localStorage
  - recordPrediction() / recordFeedback() / recordFeedbackBySymbol() API
  - updateWeightsFromFeedback(): adjusts VDSS weights (LR=0.01, decay on error)
  - Adaptive learning rate: high accuracy → lower LR, low accuracy → higher LR
  - getFeedbackStats(): accuracy by scenario, direction, recent (last 20)
  - Persistence: localStorage with SSR guard, max 500 predictions stored

- Integrated into existing codebase:
  - ta-engine.ts: added regimeResult to TAResult, calls detectRegime() in analyze()
  - ml-engine.ts: deprecated fetchMLRegime() (now returns null), documented replacement
  - composite-scores.ts: added calcSRStrengthEnhanced() with Volume Profile + Touch Count
  - sr-analyzer.ts: enhanced with approximateVolumeProfile() and countTouch() in scoring
  - msl-v4.ts: updated resolveRegime() to support 5-state regime names
  - ai-analysis route: uses toMSLRegime() when regimeResult is available
  - vdes-analysis.tsx: added regimeResult prop, displays regime in ADX paragraph
  - page.tsx: passes regimeResult from TA result to VdesAnalysis component

Stage Summary:
- All 5 items fully implemented in pure TypeScript, no external dependencies
- 3 new modules created: regime-engine.ts (~350 lines), volume-profile.ts (~260 lines), msl-feedback.ts (~280 lines)
- All existing modules updated for integration
- No lint errors, dev server compiles successfully
- fetchMLRegime() deprecated (was dead code calling non-existent Python service)

---
Task ID: 6
Agent: Main
Task: Create 3-level system documentation and add JSDoc comments to all key functions

Work Log:
- Read all 48 lib/*.ts files, 11 components/tse/*.tsx files, and all API routes
- Created SYSTEM_DOCS.md with 3 levels of documentation (Farsi):
  - Level 1: System Architecture Overview (purpose, layers, data flow, data sources, regime engines, themes)
  - Level 2: Module-Level Documentation (16 modules documented in detail with algorithms, formulas, weight breakdowns)
  - Level 3: Function/API-Level Documentation (all major functions, API routes, interfaces, data structures)
- Added JSDoc comments to 20+ source files:
  - ta-engine.ts: analyze(), calcTrend(), linearRegression(), computeHistoricalProbabilities(), OHLCV, TAResult, ScenarioResult
  - regime-engine.ts: all 20+ exported functions/types (fuzzyRegimeDetector, Markov chain, adaptiveWeightedVote, detectRegime, toMSLRegime)
  - volume-profile.ts: approximateVolumeProfile(), countTouch(), volumeAtLevel(), calculateEnhancedSRStrength()
  - msl-feedback.ts: FeedbackStore class with all 12 methods, 4 interfaces, 6 convenience functions
  - ml-engine.ts: extractVDSSFeatures(), trainAdaptiveModel(), calculateBullConsensus(), calculateScenarioProbabilities()
  - ml-logistic.ts: StandardScaler, LogisticRegressionModel, timeSeriesSplit(), AdaptiveWeightModel
  - composite-scores.ts: calcTrendStrength(), calcSRStrength(), calcSRStrengthEnhanced()
  - bayesian-weights.ts: updateIndicatorWeight(), getNormalizedWeights(), applyBayesianAdjustment()
  - sr-analyzer.ts: analyzeSupportResistance(), all internal functions
  - pattern-detection.ts: detectAllPatterns(), all pattern detectors (classic, harmonic, candlestick, Elliott)
  - decision-graph.ts: buildDecisionGraph(), enforceSumTo100(), DAG structure
  - ai-postprocess.ts: postProcessAIOutput(), validatePricesInText(), fixPersianText()
  - probability-trend.ts: buildTrendFromDailySnapshots(), getTrendInterpretation()
  - indicator-arrays.ts: computeDailyIndicators()
  - format-price.ts: all 8 functions
  - jalali.ts: all 12 functions
  - candlestick-patterns.ts: all 10 patterns
  - zai-shared.ts: all 8 functions (getZai, rateLimitedZaiCall, dedicatedAIChatCompletion, etc.)
  - API routes: analysis, vdes-analysis, ml-predict
- Created comprehensive code-to-doc alignment table in Level 3
- All documentation verified against actual implemented code

Stage Summary:
- SYSTEM_DOCS.md: ~1000 lines of 3-level documentation in Farsi
- 20+ source files enhanced with JSDoc (total ~2500 lines of documentation added)
- Zero code logic changes — only comments added
- All documented algorithms, formulas, and weights match actual code implementation
- Dev server running successfully, pre-existing lint errors unchanged
