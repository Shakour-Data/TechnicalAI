---
Task ID: 1-7
Agent: Main
Task: Implement VDss Algorithm with ML-based Adaptive Weights (7-Layer System)

Work Log:
- Read existing project structure: ta-engine.ts, ml-engine.ts, vdss-graph.tsx, indicators-panel.tsx, page.tsx
- Created /src/lib/ml-logistic.ts: Pure TypeScript ML primitives (StandardScaler, LogisticRegression with L2 regularization, TimeSeriesSplit, AdaptiveWeightModel class)
- Rewrote /src/lib/ml-engine.ts: Complete new implementation with 16 VDSS features, AdaptiveWeightModel integration, calculateBullConsensus(), calculateScenarioProbabilities(), calculateEdgeWeights()
- Updated /src/lib/ta-engine.ts: Modified TAResult interface with new ML fields (accuracy, adaptiveParams, scenarioFactors, predictionProb, etc.), rewrote Layers 2-5 to use ML-driven adaptive parameters, binary cross signals per spec
- Updated /src/components/tse/indicators-panel.tsx: Added ML engine display section showing logistic regression status, validation accuracy, ML prediction probability, adaptive parameters (momentum/volatility/trend), and top 5 feature weights with bar visualization
- Fixed pre-existing bug in vdes-analysis.tsx: toFaG() receiving null values

Stage Summary:
- Produced 3 new/rewritten files: ml-logistic.ts (new), ml-engine.ts (rewrite), ta-engine.ts (update)
- 1 component update: indicators-panel.tsx (ML display section)
- 1 bug fix: vdes-analysis.tsx null safety
- Logistic Regression trains on 16 features with TimeSeriesSplit (3 folds), L2 regularization, balanced class weights
- No fixed weights: all weights extracted from ML coefficients (sum=1 normalized)
- ML weight dynamically blended: accuracy × 0.30 max
- Adaptive parameters (momentum, volatility, trend factors) extracted from logistic regression coefficients via sigmoid transform
- Edge weights use ML-driven trend/momentum/volatility coefficients
- Scenario probabilities use ML adaptive factors
- Verified: API returns ML data (weightsUsed=true, 5216 samples, 49.9% accuracy, 63.4% P(bullish))
- Verified: All 3 sidebar panels render correctly (Indicators with ML section, VDss graph, VDes analysis)
- Verified: Zero lint errors (only pre-existing keep-server.js issues)
