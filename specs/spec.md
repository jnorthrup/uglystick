# GRAPHIQUE 2026 — Master Specification

## Project Overview
GRAPHIQUE 2026 is a **static-hosted** advanced graph visualization platform. It combines Mermaid and Graphviz DOT rendering with yFiles-inspired layout algorithms, a Monaco-based code editor, AI-powered diagnostics, and optional multi-provider LLM integration (client-side only, user-supplied API keys). The platform runs entirely in the browser with no server-side backend required — fully compatible with GitHub Pages / Netlify / Vercel static hosting.

## Goals
- World-class graph visualization with multiple layout algorithms
- Real-time code editing (Mermaid / DOT) with live preview
- AI assistant for diagram generation and repair (client-side LLM calls)
- Comprehensive export (PNG, SVG, PDF, Mermaid, DOT)
- Detachable, snappable panel system
- Beautiful, distinctive dark-first UI with theme system

## Design Direction
- **Aesthetic**: Dark-first, technical, precision tool — inspired by JetBrains IDE + observatory instruments
- **Typography**: JetBrains Mono (code), Syne (headings), Inter Variable (body)
- **Color palette**: Deep navy `#0D1117` background, electric cyan `#00D2FF` accent, warm amber `#FFB347` secondary, muted slate borders
- **Motion**: Smooth layout transitions (300ms ease-out), panel animations, node hover glow

## Technical Stack
- **Framework**: Next.js 14+ (App Router), TypeScript strict mode, static export (`output: 'export'`)
- **UI**: Tailwind CSS + shadcn/ui components
- **Graph Rendering**: Mermaid v11, D3 v7, ELK.js v0.9
- **Editor**: Monaco Editor v0.52
- **Layout**: Custom implementations + D3-force + ELK hierarchical
- **Export**: html-to-image, jsPDF, canvg
- **Validation**: Zod v3 for structured outputs
- **Storage**: localStorage (no database)
- **LLM**: Client-side direct API calls (OpenAI-compatible), disabled gracefully on static builds without keys

## Architecture Rules
1. All processing is client-side — no server API routes used for core functionality
2. LLM calls go directly browser → provider API (user provides key, stored encrypted in localStorage)
3. SVG rendering uses DOMPurify for XSS prevention
4. Graph model (IGraph) is the single source of truth — editors and renderers sync through it
5. Layout algorithms are registered in a registry — pluggable
6. Panels are composable — each can be detached to floating window or snapped to edges

## Feature List

| Feature | Status | Spec |
|---------|--------|------|
| Core Graph Model (IGraph) | planned | [specs/core-graph-model/document.md](core-graph-model/document.md) |
| Layout Engine | planned | [specs/layout-engine/document.md](layout-engine/document.md) |
| SVG Rendering Engine | planned | [specs/rendering-engine/document.md](rendering-engine/document.md) |
| Monaco Editor Integration | planned | [specs/monaco-editor/document.md](monaco-editor/document.md) |
| LLM Integration (client-side) | planned | [specs/llm-integration/document.md](llm-integration/document.md) |
| Linter & Diagnostics | planned | [specs/linter-diagnostics/document.md](linter-diagnostics/document.md) |
| Import / Export System | planned | [specs/import-export/document.md](import-export/document.md) |
| Detachable Panel System | planned | [specs/panel-system/document.md](panel-system/document.md) |
| Theme System | planned | [specs/theme-system/document.md](theme-system/document.md) |