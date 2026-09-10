-- DATABASE QUALITY IMPROVEMENT MIGRATIONS
-- Cycle 2: Performance & Structure
-- Applied to: E:\Shakour\MyProjects\TechnicalAI\db\custom.db
-- Date: 2026-09-10

-- Composite index for time-series symbol queries
CREATE INDEX IF NOT EXISTS "AiAnalysisCache_symbol_date_idx" ON "AiAnalysisCache"("symbol", "date");

-- Composite index for time-series symbol queries
CREATE INDEX IF NOT EXISTS "DecisionGraphAiCache_symbol_date_idx" ON "DecisionGraphAiCache"("symbol", "date");

-- UNIQUE natural key constraint on (symbol, date) for AiAnalysisCache
CREATE UNIQUE INDEX IF NOT EXISTS "AiAnalysisCache_symbol_date_key" ON "AiAnalysisCache"("symbol", "date");

-- UNIQUE natural key constraint on (symbol, date) for DecisionGraphAiCache
CREATE UNIQUE INDEX IF NOT EXISTS "DecisionGraphAiCache_symbol_date_key" ON "DecisionGraphAiCache"("symbol", "date");

-- Verify indexes
SELECT name, tbl_name FROM sqlite_master WHERE type='index' ORDER BY tbl_name, name;