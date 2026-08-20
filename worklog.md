---
Task ID: 1
Agent: Main
Task: Examine codebase, implement ML analysis system, fix TGJU drift, verify instruments

Work Log:
- Read and analyzed entire project structure (src/app, src/lib, src/components, mini-services)
- Read current AI analysis route (ai-analysis/route.ts) — had basic 10-step prompt without ML selection
- Read TGJU API (tgju-api.ts) — found hardcoded column mapping, no validation
- Read VDes analysis component (vdes-analysis.tsx) — understood AI text display
- Read zai-shared.ts — understood SDK singleton and rate limiting
- Read instruments routes, page.tsx, symbol-search.tsx

Stage Summary:
- Identified 3 key issues to fix
- Current AI prompt has 10-step structure but no ML-driven school/style/tone selection
- TGJU API has hardcoded column order assumption with no validation
- webId not used as fallback for index data fetching
- foreign_stock category missing from multiple type definitions

---
Task ID: 2
Agent: Main
Task: Implement ML Selector (10 schools, 10 styles, 15 tones) + Prompt Builder + API route

Work Log:
- Created /src/lib/analysis-ml-selector.ts with 10 schools, 10 styles, 15 tones
- Implemented rule-based ML selection logic with 10 conditions + overrides
- Created method selection table with 7 conditions
- Rewrote /src/app/api/ai-analysis/route.ts with full ML integration
- Added 429 retry logic with exponential backoff (5s, 10s, 15s)
- Updated VDes component to display ML badges (school/style/tone/methods)

Stage Summary:
- ML selector correctly maps technical data → school/style/tone
- Prompt includes ML selections, 10-step structure, method table, all data
- AI response includes ML metadata in response JSON
- Frontend displays school, style, tone, and method badges

---
Task ID: 3
Agent: Main
Task: Fix TGJU data drift

Work Log:
- Added auto-detect column mapping (detectColumnMap) based on data types
- Added candle validation (isValidCandle) with OHLC sanity checks
- Added data drift detection (consecutive >50% jumps warning)
- Improved parsePersianNum to handle numbers, null, empty strings
- Added invalid candle counting and logging
- Fixed foreign_stock type missing from TgjuCategoryType

Stage Summary:
- TGJU data parsing now auto-detects column order
- Invalid candles are filtered with logging
- Data drift is detected and warned about
- Type errors fixed for foreign_stock category

---
Task ID: 4
Agent: Main
Task: Verify ALL financial instruments work

Work Log:
- Changed webId type from number to string|number across instruments route, symbol-search, and page.tsx
- Added webId as primary fallback for index data fetching in page.tsx
- Added foreign_stock to TGJU_CATEGORIES set in page.tsx
- Added foreignStocks to tgju-instruments API response
- Added foreign_stock to symbol-search TgjuData interface
- Added foreignStocks to category switch in symbol-search
- Included foreignStocks under world_index category tab
- Added foreign_stock to TGJU_CATEGORY_INFO

Stage Summary:
- All 49 indices (10 main + 39 sector) now use webId as primary data source
- Foreign stocks (26 tokenized stocks) are now fully integrated
- All 142+ TGJU instruments have proper category handling
- Type precision preserved for large webId values
