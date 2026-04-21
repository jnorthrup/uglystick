"use client";
// ─────────────────────────────────────────────────────────────────────────────
// GRAPHIQUE 2026 — Graph Canvas
// viewBox-based zoom/pan. No CSS transforms. No d3-zoom.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback, useState } from "react";
import { useGraphique } from "@/store/graphique-store";
import { renderMermaidToSVG } from "@/lib/graph/svg-renderer";
import { lint } from "@/lib/linter";
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import Minimap from "./Minimap";
import HUD from "./HUD";

// ── DOT WASM: lazily-loaded Graphviz instance ────────────────────────────────
type GraphvizModule = typeof import("@hpcc-js/wasm");
type GraphvizInstance = Awaited<ReturnType<GraphvizModule["Graphviz"]["load"]>>;

let graphvizPromise: Promise<GraphvizInstance> | null = null;
function getGraphviz() {
  if (!graphvizPromise) {
    graphvizPromise = import("@hpcc-js/wasm").then((m) => m.Graphviz.load());
  }
  return graphvizPromise;
}

// viewBox state
interface VB {
  x: number;
  y: number;
  w: number;
  h: number;
}

export default function GraphCanvas() {
  const { state, dispatch } = useGraphique();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgWrapperRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [zoom, setZoom] = useState(100);
  const renderIdRef = useRef(0);

  // viewBox for zoom/pan — stored as ref so pan handler is stable
  const vbRef = useRef<VB>({ x: 0, y: 0, w: 0, h: 0 });
  const vbInitRef = useRef<VB>({ x: 0, y: 0, w: 0, h: 0 }); // original viewBox from renderer

  // pan state
  const panRef = useRef<{ active: boolean; startX: number; startY: number; vbX: number; vbY: number }>({
    active: false, startX: 0, startY: 0, vbX: 0, vbY: 0,
  });

  // Apply viewBox to the rendered SVG
  const applyViewBox = useCallback((vb: VB) => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.style.width = "100%";
    svg.style.height = "100%";
    // zoom % = original width / current width
    if (vbInitRef.current.w > 0) {
      setZoom(Math.round((vbInitRef.current.w / vb.w) * 100));
    }
  }, []);

  // Zoom to a factor relative to the initial viewBox
  const zoomTo = useCallback((factor: number) => {
    const init = vbInitRef.current;
    if (init.w === 0) return;
    const cw = init.w / factor;
    const ch = init.h / factor;
    // Keep center
    const cx = vbRef.current.x + vbRef.current.w / 2;
    const cy = vbRef.current.y + vbRef.current.h / 2;
    const vb: VB = { x: cx - cw / 2, y: cy - ch / 2, w: cw, h: ch };
    vbRef.current = vb;
    applyViewBox(vb);
  }, [applyViewBox]);

  const handleZoomIn = useCallback(() => zoomTo((vbRef.current.w / vbInitRef.current.w) * 1.3), [zoomTo]);
  const handleZoomOut = useCallback(() => zoomTo((vbRef.current.w / vbInitRef.current.w) * 0.77), [zoomTo]);

  const handleZoomFit = useCallback(() => {
    if (!containerRef.current) return;
    const init = vbInitRef.current;
    if (init.w === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const scaleX = rect.width / init.w;
    const scaleY = rect.height / init.h;
    const factor = Math.min(scaleX, scaleY, 2) * 0.9;

    const cw = init.w / factor;
    const ch = init.h / factor;
    const cx = init.x + init.w / 2;
    const cy = init.y + init.h / 2;
    const vb: VB = { x: cx - cw / 2, y: cy - ch / 2, w: cw, h: ch };
    vbRef.current = vb;
    applyViewBox(vb);
  }, [applyViewBox]);

  const handleZoomReset = useCallback(() => {
    const init = vbInitRef.current;
    if (init.w === 0) return;
    vbRef.current = { ...init };
    applyViewBox(init);
  }, [applyViewBox]);

  // Mouse pan handlers
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const vb = vbRef.current;
    panRef.current = { active: true, startX: e.clientX, startY: e.clientY, vbX: vb.x, vbY: vb.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const p = panRef.current;
    if (!p.active) return;
    const svg = svgRef.current;
    if (!svg) return;

    // Convert pixel delta to viewBox units
    const rect = svg.getBoundingClientRect();
    const scaleX = vbRef.current.w / rect.width;
    const scaleY = vbRef.current.h / rect.height;

    const dx = (e.clientX - p.startX) * scaleX;
    const dy = (e.clientY - p.startY) * scaleY;

    const vb: VB = { x: p.vbX - dx, y: p.vbY - dy, w: vbRef.current.w, h: vbRef.current.h };
    vbRef.current = vb;
    applyViewBox(vb);
  }, [applyViewBox]);

  const onPointerUp = useCallback(() => {
    panRef.current.active = false;
  }, []);

  // Wheel zoom
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.08 : 1 / 1.08;
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width; // 0..1
    const my = (e.clientY - rect.top) / rect.height;

    const vb = vbRef.current;
    const newW = vb.w * factor;
    const newH = vb.h * factor;

    // Zoom toward cursor position
    const newX = vb.x + (vb.w - newW) * mx;
    const newY = vb.y + (vb.h - newH) * my;

    const newVb: VB = { x: newX, y: newY, w: newW, h: newH };
    vbRef.current = newVb;
    applyViewBox(newVb);
  }, [applyViewBox]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const renderDiagram = useCallback(async () => {
    if (!svgWrapperRef.current) return;

    const renderId = ++renderIdRef.current;
    dispatch({ type: "SET_IS_RENDERING", rendering: true });

    const lintResult = lint(state.code, state.format);
    dispatch({ type: "SET_DIAGNOSTICS", diagnostics: lintResult.diagnostics });

    try {
      let svgStr = "";
      let nodeCount = 0;
      let edgeCount = 0;

      if (state.format === "mermaid") {
        const result = await renderMermaidToSVG(state.code, state.layout, state.direction, state.theme);
        svgStr = result.svg;
        nodeCount = result.nodeCount;
        edgeCount = result.edgeCount;
        if (renderId !== renderIdRef.current) return;

        svgWrapperRef.current.innerHTML = svgStr;
        result.bindFunctions?.(svgWrapperRef.current);
        const svg = svgWrapperRef.current.querySelector("svg");
        if (svg) {
          svgRef.current = svg;
          const originalViewBox = svg.getAttribute("viewBox");
          if (originalViewBox) {
            svg.setAttribute("data-original-view-box", originalViewBox);
          }
          const originalWidth = svg.getAttribute("width");
          const originalHeight = svg.getAttribute("height");
          if (originalWidth) {
            svg.setAttribute("data-original-width", originalWidth);
          }
          if (originalHeight) {
            svg.setAttribute("data-original-height", originalHeight);
          }
          // Store initial viewBox
          const vbW = Number.parseFloat(svg.getAttribute("viewBox")?.split(" ")[2] || "800");
          const vbH = Number.parseFloat(svg.getAttribute("viewBox")?.split(" ")[3] || "600");
          const vbX = Number.parseFloat(svg.getAttribute("viewBox")?.split(" ")[0] || "0");
          const vbY = Number.parseFloat(svg.getAttribute("viewBox")?.split(" ")[1] || "0");
          const init: VB = { x: vbX, y: vbY, w: vbW, h: vbH };
          vbInitRef.current = init;
          vbRef.current = { ...init };
        } else {
          svgRef.current = null;
        }

        dispatch({ type: "SET_RENDER_ERROR", error: null });
        if (result.errors.length > 0) {
          dispatch({ type: "SET_RENDER_ERROR", error: result.errors.join("\n") });
        }
      } else if (state.format === "dot") {
        const graphviz = await getGraphviz();
        if (renderId !== renderIdRef.current) return;

        const rawSvg = graphviz.dot(state.code, "svg");
        let safeSvg = rawSvg;
        if (typeof window !== "undefined") {
          const DOMPurify = (await import("dompurify")).default;
          safeSvg = DOMPurify.sanitize(rawSvg, { USE_PROFILES: { svg: true, svgFilters: true } });
        }

        svgWrapperRef.current.innerHTML = safeSvg;
        const svg = svgWrapperRef.current.querySelector("svg");
        if (svg) {
          svgRef.current = svg;
          const originalViewBox = svg.getAttribute("viewBox");
          if (originalViewBox) {
            svg.setAttribute("data-original-view-box", originalViewBox);
          }
          const originalWidth = svg.getAttribute("width");
          const originalHeight = svg.getAttribute("height");
          if (originalWidth) {
            svg.setAttribute("data-original-width", originalWidth);
          }
          if (originalHeight) {
            svg.setAttribute("data-original-height", originalHeight);
          }
          // DOT SVG may not have viewBox — use bounding box
          const vbAttr = svg.getAttribute("viewBox");
          if (vbAttr) {
            const parts = vbAttr.split(" ").map(Number);
            const init: VB = { x: parts[0] || 0, y: parts[1] || 0, w: parts[2] || 800, h: parts[3] || 600 };
            vbInitRef.current = init;
            vbRef.current = { ...init };
          }
        }

        const nodeMatches = state.code.match(/\b([A-Za-z_]\w*)\b/g) || [];
        const keywords = new Set(["digraph", "graph", "subgraph", "node", "edge", "rank", "rankdir", "strict"]);
        const uniqueNodes = new Set(nodeMatches.filter((n) => !keywords.has(n.toLowerCase())));
        nodeCount = uniqueNodes.size;
        edgeCount = (state.code.match(/->|--/g) || []).length;

        dispatch({ type: "SET_RENDER_ERROR", error: null });
      }

      if (renderId !== renderIdRef.current) return;

      dispatch({ type: "SET_GRAPH_STATS", nodeCount, edgeCount });
      dispatch({ type: "SET_IS_RENDERING", rendering: false });

      // Fit to screen after render
      requestAnimationFrame(() => handleZoomFit());
    } catch (err) {
      if (renderId !== renderIdRef.current) return;
      dispatch({
        type: "SET_RENDER_ERROR",
        error: err instanceof Error ? err.message : String(err),
      });
      dispatch({ type: "SET_IS_RENDERING", rendering: false });
    }
  }, [state.code, state.format, state.theme, state.layout, state.direction, dispatch, handleZoomFit]);

  useEffect(() => {
    renderDiagram();
  }, [renderDiagram]);

  return (
    <div className="graph-canvas-wrapper relative flex flex-col h-full bg-canvas overflow-hidden">
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
        style={{ background: "var(--canvas-bg)" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
      >
        {/* Grid background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(0,210,255,0.07) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* SVG container — pointerEvents auto so SVG gets events */}
        <div
          ref={svgWrapperRef}
          className="absolute inset-0"
        />

        {state.renderError && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-red-900/80 border border-red-500/60 rounded-lg p-6 max-w-lg backdrop-blur-sm">
              <p className="text-red-300 text-sm font-mono mb-1 font-bold">Render Error</p>
              <p className="text-red-200 text-xs font-mono whitespace-pre-wrap leading-relaxed">
                {state.renderError}
              </p>
            </div>
          </div>
        )}

        {state.isRendering && (
          <div className="absolute top-4 right-4 flex items-center gap-2 bg-surface/80 rounded-full px-3 py-1.5 backdrop-blur-sm border border-cyan-500/20">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs text-cyan-400 font-mono">Rendering…</span>
          </div>
        )}

        {/* HUD Overlay */}
        <HUD />
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-20 right-4 flex flex-col gap-1 z-10">
        <Button size="icon" variant="ghost" onClick={handleZoomIn} className="w-8 h-8 bg-surface/80 border border-border/50 backdrop-blur-sm text-muted-foreground hover:text-cyan-400 hover:border-cyan-500/50" title="Zoom In">
          <ZoomIn className="w-3.5 h-3.5" />
        </Button>
        <Button size="icon" variant="ghost" onClick={handleZoomOut} className="w-8 h-8 bg-surface/80 border border-border/50 backdrop-blur-sm text-muted-foreground hover:text-cyan-400 hover:border-cyan-500/50" title="Zoom Out">
          <ZoomOut className="w-3.5 h-3.5" />
        </Button>
        <Button size="icon" variant="ghost" onClick={handleZoomFit} className="w-8 h-8 bg-surface/80 border border-border/50 backdrop-blur-sm text-muted-foreground hover:text-cyan-400 hover:border-cyan-500/50" title="Fit to Screen">
          <Maximize2 className="w-3.5 h-3.5" />
        </Button>
        <Button size="icon" variant="ghost" onClick={handleZoomReset} className="w-8 h-8 bg-surface/80 border border-border/50 backdrop-blur-sm text-muted-foreground hover:text-amber-400 hover:border-amber-500/50" title="Reset Zoom">
          <RotateCcw className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Zoom badge */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10">
        <span className="bg-surface/70 border border-border/40 text-muted-foreground text-xs font-mono px-2 py-0.5 rounded backdrop-blur-sm">
          {zoom}%
        </span>
      </div>

      {state.minimapOpen && (
        <Minimap
          svgWrapperRef={svgWrapperRef}
          onNavigate={(relX, relY) => {
            const vb = vbRef.current;
            const init = vbInitRef.current;
            if (init.w === 0) return;
            const newX = init.x + relX * init.w - vb.w / 2;
            const newY = init.y + relY * init.h - vb.h / 2;
            const newVb: VB = { x: newX, y: newY, w: vb.w, h: vb.h };
            vbRef.current = newVb;
            applyViewBox(newVb);
          }}
        />
      )}
    </div>
  );
}
