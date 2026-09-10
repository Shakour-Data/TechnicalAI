-- DATABASE QUALITY IMPROVEMENT MIGRATIONS
-- Cycle 3: Usability & Security
-- Applied to: E:\Shakour\MyProjects\TechnicalAI\db\custom.db
-- Date: 2026-09-10

-- Triggers for auto-updating updatedAt
-- User table
CREATE TRIGGER IF NOT EXISTS "User_update_trigger"
AFTER UPDATE ON "User"
FOR EACH ROW
WHEN NEW."id" = OLD."id"
BEGIN
    UPDATE "User" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = NEW."id";
END;

CREATE TRIGGER IF NOT EXISTS "User_insert_trigger"
AFTER INSERT ON "User"
FOR EACH ROW
BEGIN
    UPDATE "User" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = NEW."id";
END;

-- Post table
CREATE TRIGGER IF NOT EXISTS "Post_update_trigger"
AFTER UPDATE ON "Post"
FOR EACH ROW
WHEN NEW."id" = OLD."id"
BEGIN
    UPDATE "Post" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = NEW."id";
END;

CREATE TRIGGER IF NOT EXISTS "Post_insert_trigger"
AFTER INSERT ON "Post"
FOR EACH ROW
BEGIN
    UPDATE "Post" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = NEW."id";
END;

-- AiAnalysisCache table
CREATE TRIGGER IF NOT EXISTS "AiAnalysisCache_update_trigger"
AFTER UPDATE ON "AiAnalysisCache"
FOR EACH ROW
WHEN NEW."id" = OLD."id"
BEGIN
    UPDATE "AiAnalysisCache" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = NEW."id";
END;

CREATE TRIGGER IF NOT EXISTS "AiAnalysisCache_insert_trigger"
AFTER INSERT ON "AiAnalysisCache"
FOR EACH ROW
BEGIN
    UPDATE "AiAnalysisCache" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = NEW."id";
END;

-- DecisionGraphAiCache table
CREATE TRIGGER IF NOT EXISTS "DecisionGraphAiCache_update_trigger"
AFTER UPDATE ON "DecisionGraphAiCache"
FOR EACH ROW
WHEN NEW."id" = OLD."id"
BEGIN
    UPDATE "DecisionGraphAiCache" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = NEW."id";
END;

CREATE TRIGGER IF NOT EXISTS "DecisionGraphAiCache_insert_trigger"
AFTER INSERT ON "DecisionGraphAiCache"
FOR EACH ROW
BEGIN
    UPDATE "DecisionGraphAiCache" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = NEW."id";
END;

-- WAL configuration
PRAGMA wal_autocheckpoint = 1000;
PRAGMA temp_store = MEMORY;
PRAGMA cache_size = -10000; -- 10MB
PRAGMA mmap_size = 268435456; -- 256MB

-- Verify
SELECT name, tbl_name FROM sqlite_master WHERE type='trigger' ORDER BY tbl_name, name;
PRAGMA journal_mode;
PRAGMA wal_autocheckpoint;
PRAGMA foreign_keys;