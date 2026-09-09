---
Task ID: 2-a
Agent: full-stack-developer
Task: Redesign VdesAnalysis component to dark theme matching example HTML

Work Log:
- Read example HTML template from /home/z/my-project/upload/Example_VDes_yyyymmdd.html
- Read current VdesAnalysis component (1270 lines)
- Changed header to dark glass morphism with golden styling (#f8e365 title, rgba(18,28,46,0.7) bg, blur(14px), rgba(255,215,100,0.25) border, 32px radius)
- Changed header subtitle badges to 3 items: reference price (📍), short-term target (🎯), date (📅)
- Changed support/resistance to 2-column grid with list-style rows (grade badge + price)
- Support header: 🛡️ حمایت‌ها with #59e39b color
- Resistance header: ⚠️ مقاومت‌ها with #ff758a color
- Changed scenario display from 9-card grid to TABLE format (R9→R1 order)
- Table columns: سناریو, احتمال اختصاصی, احتمال تجمعی, هدف قیمتی
- Table row right-border: up=#59e39b, down=#ff758a, pullback=#ffb25f
- Individual prob: golden badge (#f8e365) with rgba(248,227,101,0.08) bg
- Cumulative prob: #d4e4ff
- Changed analysis text section to dark panel with #d0def0 text color
- Strong/bold text: #f8e365, emerald text: #59e39b, red text: #ff758a
- Highlight box: rgba(248,227,101,0.06) bg with #f8e365 right border
- Removed Price Targets section entirely
- Added dark-themed strategy tag with type-based coloring
- Added footer disclaimer in #5a7395
- Updated exportHTML to generate dark-themed HTML with table format
- Updated PDF export backgroundColor from #f3f4f6 to #0b0f1a
- Updated VdesAnalysisSkeleton for dark theme
- Export toolbar dropdown styled with dark bg
- All other export functions (exportText, exportExcel, exportCSV, exportChartImage) preserved unchanged
- Added strategyType variable for dark theme color derivation

Stage Summary:
- VdesAnalysis now uses dark theme (#0b0f1a background) matching the example HTML
- Scenario table shows R9→R1 order with cumulative probabilities
- All exports updated to dark theme
- No state management, hooks, import statements, or logic code was changed
- Lint passes (no errors in vdes-analysis.tsx)
- Dev server compiles successfully
