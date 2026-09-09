# Task 3 - Enhance Fallback Analysis Text Generation

## Agent: Main

## Summary
Enhanced the fallback (non-AI) analysis text generation in `vdes-analysis.tsx` with decision graph analysis, probability trends, diversity, and retry button.

## Changes Made

### File: `/home/z/my-project/src/components/tse/vdes-analysis.tsx`

1. **AnalysisContext interface** — Added `probabilityTrend` and `decisionGraph` optional fields
2. **generateAnalysisText()** — Major enhancement:
   - Diversity seed from symbolName hash (4 phrasing variants per paragraph type)
   - NEW: Decision Graph Analysis paragraph (branch probs, path contributions, node signals)
   - NEW: Probability Trends paragraph (top 3 scenarios, cumulative probs, trend directions)
   - Enhanced P1/P2/P5 with diverse phrasing
   - Return changed from 5 paragraphs to 7 paragraphs
3. **analysisParagraphs useMemo** — Passes `probabilityTrend` and `decisionGraph` to generateAnalysisText
4. **JSX fallback section** — Added warning banner + "تلاش مجدد برای تحلیل هوشمند" retry button

### File: `/home/z/my-project/worklog.md`
- Appended detailed work record

## Verification
- No new lint errors (pre-existing only)
- Dev server compiles successfully
- Fixed pre-existing TS error (SC1: R1 destructuring)
