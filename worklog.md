---
Task ID: 1
Agent: Main Agent
Task: Fix TGJU analysis showing year 1392 chart data instead of current data

Work Log:
- Identified ROOT CAUSE: `tryDirectFetch` and `fetchTgjuHistoryViaPageReader` both used `order_dir=asc&start=0&length=365` which returns the OLDEST 365 candles from TGJU API
- For instruments with long history (gold since 1390, dollar since 1390), this returned data starting from year 1390-1392
- Confirmed with direct API test: `order_dir=asc` returns 1390/09/05 data (price 13,700), `order_dir=desc` returns 1405/06/09 data (price 2,093,000)
- Fixed `tryDirectFetch`: changed `order_dir=asc` to `order_dir=desc` 
- Fixed `fetchTgjuHistoryViaPageReader`: changed `order_dir=asc` to `order_dir=desc`
- Added `isDataFresh()` function to validate candle data is not older than 2 years
- Added freshness validation in `parseTgjuChartData()` to reject stale data at parse time
- Added freshness check in in-memory cache path (fetchTgjuHistory step 0)
- Added freshness check in file-based cache reader (readFromFileCache)
- Added freshness check in stale cache fallback (fetchTgjuHistory step 3)
- Added `unlink` import for deleting stale file cache entries
- Added price sanity check to AI analysis daily cache: invalidate if price differs >5%
- Verified fix: `price_dollar_rl` now returns 361 candles from 1404-02-31 to 1405-06-09
- Verified previous fixes still in place: currency unit (ریال), post-processing regex (SC, R, MA, RSI, MACD, etc.), AI prompt rules 21 & 22

Stage Summary:
- Root cause: `order_dir=asc` in TGJU chart API fetch returned oldest data (year 1390-1392)
- Fix: Changed to `order_dir=desc` to get most recent 365 candles
- Defense-in-depth: Added `isDataFresh()` validation at every cache/data layer
- AI cache: Added price sanity check (5% threshold) to invalidate wrong analyses
- All existing fixes verified intact (currency unit, technical code removal, forward-looking prompt)
