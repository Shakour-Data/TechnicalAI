---
Task ID: 1
Agent: main
Task: رنگ حمایت/مقاومت/MA + باگ‌های AI + صفحه اول + سناریوها

Work Log:
- Changed support line color from green (#22a366) to blue (#2563eb)
- Changed resistance line color from red (#e04060) to orange (#ea580c)
- Changed target support/resistance colors accordingly
- Changed MA colors to forbidden-safe palette (violet, cyan, fuchsia, purple, pink)
- Fixed AI system prompt role from 'assistant' to 'system'
- Added 1-hour in-memory cache for AI analysis responses
- Removed duplicate methods listing from prompt (steps 1 & 5 were identical)
- Improved 429 retry logic: exponential backoff with jitter (15s, 30s, 60s)
- Reduced max retries from 5 to 3
- Removed all emojis from vdes-analysis.tsx UI
- Built beautiful landing page with hero, features grid, how-it-works, AI system explanation, data sources
- Updated footer to v5.0
- Renamed R1-R5 to سناریوی ۱-۵ in vdes-analysis.tsx and vdss-graph.tsx
- Improved AI prompt with dynamic scenario naming (sorted by probability)

Stage Summary:
- All v5 changes implemented
- Lint passes clean
- Dev server compiles successfully
