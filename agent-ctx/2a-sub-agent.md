# Task 2a - Fix TSETMC Index Data Integration

## Work Record

### Files Modified
1. `/home/z/my-project/src/lib/tsetmc-index-api.ts` - Added warmup(), file-based caching, 3-tier cache
2. `/home/z/my-project/src/lib/industry-indices.ts` - Updated to 39 sectors with correct names
3. `/home/z/my-project/src/app/api/finpy-sector/route.ts` - Added warmup trigger, empty webId handling
4. `/home/z/my-project/src/app/page.tsx` - Updated loading message
5. `/home/z/my-project/worklog.md` - Appended task record

### Key Changes
- **warmup()**: Pre-initializes z-ai SDK to avoid 15-30s first-call delay
- **File cache**: 24h TTL, stored as `db/index-{key}.json`, same pattern as stock candles
- **3-tier cache**: memory → file → TSETMC CDN
- **39 sectors**: All sectors from user's list, 6 NEW (empty webId)
- **finpySector corrections**: 'دارویی' → 'مواد دارویی', 'بانک' → 'بانکها', etc.

### Verification
- ESLint: 0 errors
- TypeScript: 0 syntax errors
- All Persian text correct with proper ZWNJ