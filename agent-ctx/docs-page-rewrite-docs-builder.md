# Task: Build Comprehensive Documentation Page for Persian FTA System

## Task ID: docs-page-rewrite

## Summary
Rewrote `/home/z/my-project/src/components/docs-page.tsx` as a comprehensive, beautiful documentation page that renders ALL 63 diagrams (13 DFD + 8 BPMN + 21 UML Structural + 21 UML Behavioral) from the generated source files.

## Work Done

### 1. Parsed Source Files
- Read and parsed `dfd-diagrams.md` — 13 DFD diagrams (levels 0-3) in Mermaid format
- Read and parsed `bpmn-diagrams.md` — 8 BPMN diagrams (levels 1-3) in Mermaid format  
- Read and parsed `uml-structural-diagrams.puml` — 21 UML structural diagrams (7 types × 3 levels) in PlantUML format
- Read and parsed `persian-fta-behavioral-diagrams.puml` — 21 UML behavioral/interaction diagrams (7 types × 3 levels) in PlantUML format

### 2. Generated Diagram Data File
Created `/home/z/my-project/src/lib/diagram-data.ts` (4463 lines) containing:
- `DFD_DIAGRAMS` — 13 diagrams with id, title, description, level, code
- `BPMN_DIAGRAMS` — 8 diagrams with id, title, description, level, happyPath, exceptionFlows, code
- `UML_STRUCT_DIAGRAMS` — 21 diagrams with id, title, description, level, code
- `UML_BEHAV_DIAGRAMS` — 21 diagrams with id, title, description, level, code

### 3. Built Comprehensive docs-page.tsx
Key features implemented:
- **RTL layout** throughout (dir="rtl")
- **Navigation sidebar** (right side, collapsible) with tree structure for all sections
- **Search functionality** to filter diagrams by title, description, or id
- **Zoom controls** (0.5x to 2.0x) with zoom in/out/reset buttons
- **Dark theme support** using useTheme() from theme-store
- **Gradient hero banner** at top with system name and statistics
- **Card-based layout** for each diagram with rounded corners, shadows
- **Color-coded level badges**: Level 0=slate, Level 1=emerald, Level 2=amber, Level 3=rose
- **Type badges**: DFD=cyan, BPMN=violet, UML=purple
- **Format badges**: Mermaid=green, PlantUML=orange
- **BPMN Happy Path** shown in green box with TrendingUp icon
- **BPMN Exception Flows** shown in amber box with Shield icon
- **Coherence section** showing relationships between diagram types
- **Statistics bar** showing total diagrams per type
- **Responsive design** — sidebar collapses on mobile
- **"Show all diagrams"** button to browse all 63 at once
- **MermaidDiagram** component for .md diagram rendering
- **PlantUMLDiagram** component for .puml diagram rendering

## Files Modified
- `/home/z/my-project/src/components/docs-page.tsx` — Complete rewrite (878 lines)
- `/home/z/my-project/src/lib/diagram-data.ts` — New file (4463 lines)

## Verification
- TypeScript compilation: ✅ No errors
- ESLint: ✅ No errors for our files
- Dev server: ✅ Compiled successfully
