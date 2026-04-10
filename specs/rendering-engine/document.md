# SVG Rendering Engine — Feature Spec

## Overview
Pure SVG renderer consuming IGraph. Handles pan/zoom, selection, hover states, animated layout transitions, and export to PNG/SVG/PDF.

## Functional Requirements
- Render nodes as SVG shapes matching INode.shape
- Render edges as SVG paths with arrow markers
- CSS custom properties for theming
- Pan/zoom via d3-zoom (mouse wheel + drag)
- Zoom to fit / zoom to selection commands
- Minimap synchronized with main viewport
- Node hover glow effect
- Multi-select via lasso (drag selection box)
- Inline label editing on double-click
- DOMPurify sanitization of all SVG output

## Export
- PNG: html-to-image or canvas rasterization, transparent bg support
- SVG: serialize current DOM SVG with styles inlined
- PDF: jsPDF with SVG embedded

## Acceptance Criteria
- [ ] 500-node graph renders in < 100ms
- [ ] Pan and zoom work with mouse wheel on all browsers
- [ ] Selection highlights correct nodes/edges
- [ ] PNG export produces correct rasterization at 2x scale
- [ ] DOMPurify strips XSS payloads from Mermaid output

## Status
planned