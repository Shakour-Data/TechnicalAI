-- DATABASE QUALITY IMPROVEMENT MIGRATIONS
-- Cycle 1: Integrity & Runtime
-- Applied to: E:\Shakour\MyProjects\TechnicalAI\db\custom.db
-- Date: 2026-09-10

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- Create temporary tables with improved schema
-- We'll copy data from old to new

-- User table: add email CHECK, default for updatedAt
CREATE TABLE "User_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE CHECK (email LIKE '%_@__%.__%'),
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Post table: add FK to User, CHECK on published, default for updatedAt
CREATE TABLE "Post_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false CHECK (published IN (0, 1)),
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- AiAnalysisCache table: add CHECK on price, default for updatedAt
CREATE TABLE "AiAnalysisCache_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "ml" TEXT NOT NULL,
    "price" REAL NOT NULL CHECK (price >= 0),
    "priceHash" TEXT NOT NULL DEFAULT '0',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- DecisionGraphAiCache table: add CHECK on price, default for updatedAt
CREATE TABLE "DecisionGraphAiCache_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "price" REAL NOT NULL CHECK (price >= 0),
    "priceHash" TEXT NOT NULL DEFAULT '0',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Copy data from old tables
INSERT INTO "User_new" ("id", "email", "name", "createdAt", "updatedAt")
SELECT "id", "email", "name", "createdAt", "updatedAt" FROM "User";

INSERT INTO "Post_new" ("id", "title", "content", "published", "authorId", "createdAt", "updatedAt")
SELECT "id", "title", "content", "published", "authorId", "createdAt", "updatedAt" FROM "Post";

INSERT INTO "AiAnalysisCache_new" ("id", "symbol", "date", "text", "ml", "price", "priceHash", "createdAt", "updatedAt")
SELECT "id", "symbol", "date", "text", "ml", "price", "priceHash", "createdAt", "updatedAt" FROM "AiAnalysisCache";

INSERT INTO "DecisionGraphAiCache_new" ("id", "symbol", "date", "text", "price", "priceHash", "createdAt", "updatedAt")
SELECT "id", "symbol", "date", "text", "price", "priceHash", "createdAt", "updatedAt" FROM "DecisionGraphAiCache";

-- Drop old tables
DROP TABLE "User";
DROP TABLE "Post";
DROP TABLE "AiAnalysisCache";
DROP TABLE "DecisionGraphAiCache";

-- Rename new tables to original names
ALTER TABLE "User_new" RENAME TO "User";
ALTER TABLE "Post_new" RENAME TO "Post";
ALTER TABLE "AiAnalysisCache_new" RENAME TO "AiAnalysisCache";
ALTER TABLE "DecisionGraphAiCache_new" RENAME TO "DecisionGraphAiCache";

-- Recreate indexes (they were lost when dropping tables)
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE INDEX IF NOT EXISTS "AiAnalysisCache_createdAt_idx" ON "AiAnalysisCache"("createdAt");
CREATE INDEX IF NOT EXISTS "AiAnalysisCache_date_idx" ON "AiAnalysisCache"("date");
CREATE INDEX IF NOT EXISTS "AiAnalysisCache_symbol_idx" ON "AiAnalysisCache"("symbol");
CREATE UNIQUE INDEX IF NOT EXISTS "AiAnalysisCache_symbol_priceHash_key" ON "AiAnalysisCache"("symbol", "priceHash");
CREATE INDEX IF NOT EXISTS "DecisionGraphAiCache_createdAt_idx" ON "DecisionGraphAiCache"("createdAt");
CREATE INDEX IF NOT EXISTS "DecisionGraphAiCache_date_idx" ON "DecisionGraphAiCache"("date");
CREATE INDEX IF NOT EXISTS "DecisionGraphAiCache_symbol_idx" ON "DecisionGraphAiCache"("symbol");
CREATE UNIQUE INDEX IF NOT EXISTS "DecisionGraphAiCache_symbol_priceHash_key" ON "DecisionGraphAiCache"("symbol", "priceHash");

-- Add additional indexes for performance
CREATE INDEX IF NOT EXISTS "Post_authorId_idx" ON "Post"("authorId");

PRAGMA foreign_key_check;
PRAGMA integrity_check;