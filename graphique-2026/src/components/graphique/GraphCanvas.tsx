"use client";
// ─────────────────────────────────────────────────────────────────────────────
// GRAPHIQUE 2026 — Graph Canvas (Mermaid SVG + D3 Pan/Zoom)
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback, useState } from "react";
import { useGraphique } from "@/store/graphique-store";
import { themeToMermaid, extractFlowchartStats, injectLayoutForAlgorithm } from "@/lib/graph/mermaid-utils";
import { lint } from "@/lib/linter";
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import Minimap from "./Minimap";

let d3ZoomInstance: ReturnType<typeof import("d3-zoom")["zoom"]> | null = null;
let d3Selection: unknown = null;

// ── DOT WASM: lazily-loaded Graphviz instance ────────────────────────────────
let graphvizPromise: Promise<import("@hpcc-js/wasm").Graphviz> | null = null;
function getGraphviz() {
  if (!graphvizPromise) {
    graphvizPromise = import("@hpcc-js/wasm/graphviz").then((m) => m.Graphviz.load());
  }
  return graphvizPromise;
}

export default function GraphCanvas() {
  const { state, dispatch } = useGraphique();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgWrapperRef = useRef<HTMLDivElement>(null);
  const zoomGroupRef = useRef<SVGGElement | null>(null);
  const [zoom, setZoom] = useState(100);
  const renderIdRef = useRef(0);

  const renderDiagram = useCallback(async () => {
    if (!svgWrapperRef.current) return;

    const renderId = ++renderIdRef.current;
    dispatch({ type: "SET_IS_RENDERING", rendering: true });

    // Run linter
    const lintResult = lint(state.code, state.format);
    dispatch({ type: "SET_DIAGNOSTICS", diagnostics: lintResult.diagnostics });

    if (state.format === "mermaid") {
      try {
        const mermaid = (await import("mermaid")).default;

        const mermaidTheme = themeToMermaid(state.theme);

        mermaid.initialize({
          startOnLoad: false,
          theme: mermaidTheme as "dark" | "default" | "forest" | "neutral" | "base",
          securityLevel: "loose",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 14,
          htmlLabels: true,
          flowchart: {
            curve: "basis",
            padding: 20,
            nodeSpacing: 50,
            rankSpacing: 60,
            htmlLabels: true,
          },
          themeVariables:
            mermaidTheme === "dark"
              ? {
                  primaryColor: "#1e3a5f",
                  primaryBorderColor: "#00D2FF",
                  lineColor: "#00D2FF",
                  secondaryColor: "#2d1f5e",
                  tertiaryColor: "#0d1117",
                  background: "#0D1117",
                  mainBkg: "#1e2d40",
                  nodeBorder: "#00D2FF",
                  clusterBkg: "#151f2e",
                  titleColor: "#00D2FF",
                  edgeLabelBackground: "#1a2744",
                  // Do NOT override primaryTextColor — let theme default handle it
                }
              : {},
        });

        // Inject layout algorithm config (ELK for elk-* algorithms)
        const codeWithLayout = injectLayoutForAlgorithm(state.code, state.layout, state.direction);

        // Generate unique id for this render
        const id = `graphique-${Date.now()}`;

        const { svg } = await mermaid.render(id, codeWithLayout);

        if (renderId !== renderIdRef.current) return; // stale render

        // Sanitize with DOMPurify
        let safeSvg = svg;
        if (typeof window !== "undefined") {
          const DOMPurify = (await import("dompurify")).default;
          safeSvg = DOMPurify.sanitize(svg, {
            USE_PROFILES: { svg: true, svgFilters: true },
          });
        }

        svgWrapperRef.current.innerHTML = safeSvg;

        // Extract stats
        const stats = extractFlowchartStats(state.code);
        dispatch({
          type: "SET_GRAPH_STATS",
          nodeCount: stats.nodeCount,
          edgeCount: stats.edgeCount,
        });

        dispatch({ type: "SET_RENDER_ERROR", error: null });

        // Apply d3-zoom after render
        requestAnimationFrame(() => applyZoom());
      } catch (err) {
        if (renderId !== renderIdRef.current) return;
        dispatch({
          type: "SET_RENDER_ERROR",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else if (state.format === "dot") {
      try {
        const graphviz = await getGraphviz();
        if (renderId !== renderIdRef.current) return;

        const svg = graphviz.dot(state.code, "svg");

        if (renderId !== renderIdRef.current) return;

        let safeSvg = svg;
        if (typeof window !== "undefined") {
          const DOMPurify = (await import("dompurify")).default;
          safeSvg = DOMPurify.sanitize(svg, {
            USE_PROFILES: { svg: true, svgFilters: true },
          });
        }

        svgWrapperRef.current.innerHTML = safeSvg;

        // Extract DOT stats: count unique node names and edges
        const nodeMatches = state.code.match(/\b([A-Za-z_]\w*)\b/g) || [];
        const keywords = new Set(["digraph", "graph", "subgraph", "node", "edge", "rank", "rankdir", "strict"]);
        const uniqueNodes = new Set(nodeMatches.filter((n) => !keywords.has(n.toLowerCase())));
        const edgeCount = (state.code.match(/->|--/g) || []).length;

        dispatch({
          type: "SET_GRAPH_STATS",
          nodeCount: uniqueNodes.size,
          edgeCount,
        });

        dispatch({ type: "SET_RENDER_ERROR", error: null });
        requestAnimationFrame(() => applyZoom());
      } catch (err) {
        if (renderId !== renderIdRef.current) return;
        dispatch({
          type: "SET_RENDER_ERROR",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    dispatch({ type: "SET_IS_RENDERING", rendering: false });
  }, [state.code, state.format, state.theme, state.layout, state.direction, dispatch]);

  const applyZoom = useCallback(async () => {
    if (!containerRef.current || !svgWrapperRef.current) return;

    const svgEl = svgWrapperRef.current.querySelector("svg");
    if (!svgEl) return;

    // Set SVG dimensions
    svgEl.style.width = "100%";
    svgEl.style.height = "100%";
    svgEl.removeAttribute("width");
    svgEl.removeAttribute("height");

    const { zoom, select, zoomIdentity } = await import("d3");

    const container = select(containerRef.current);

    // Remove existing zoom
    if (d3ZoomInstance) {
      container.on(".zoom", null);
    }

    const zoomBehavior = zoom<HTMLDivElement, unknown>()
      .scaleExtent([0.05, 10])
      .on("zoom", (event) => {
        const { transform } = event;
        svgEl.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`;
        svgEl.style.transformOrigin = "0 0";
        setZoom(Math.round(transform.k * 100));
      });

    d3ZoomInstance = zoomBehavior;
    // biome-ignore lint: d3 selection typing
    d3Selection = container;

    container.call(zoomBehavior as Parameters<typeof container.call>[0]);

    // Zoom to fit
    zoomToFit(svgEl, containerRef.current, zoomBehavior, container, zoomIdentity);
  }, []);

  function zoomToFit(
    svgEl: SVGElement,
    containerEl: HTMLElement,
    zoomBehavior: ReturnType<typeof import("d3")["zoom"]>,
    container: ReturnType<typeof import("d3")["select"]>,
    zoomIdentity: typeof import("d3")["zoomIdentity"]
  ) {
    const containerRect = containerEl.getBoundingClientRect();
    const svgRect = svgEl.getBoundingClientRect();

    if (!containerRect.width || !svgRect.width) return;

    const scaleX = (containerRect.width * 0.85) / svgRect.width;
    const scaleY = (containerRect.height * 0.85) / svgRect.height;
    const scale = Math.min(scaleX, scaleY, 1.5);

    const tx = (containerRect.width - svgRect.width * scale) / 2;
    const ty = (containerRect.height - svgRect.height * scale) / 2;

    const identity = zoomIdentity.translate(tx, ty).scale(scale);
    (container as ReturnType<typeof import("d3")["select"]>)
      .transition()
      .duration(400)
      // biome-ignore lint: d3 call
      .call((zoomBehavior as ReturnType<typeof import("d3")["zoom"]>).transform, identity);

    setZoom(Math.round(scale * 100));
  }

  const handleZoomIn = useCallback(() => {
    if (!d3ZoomInstance || !d3Selection || !containerRef.current) return;
    import("d3").then(({ select }) => {
      const container = select(containerRef.current!);
      (container as ReturnType<typeof import("d3")["select"]>)
        .transition()
        .duration(200)
        // biome-ignore lint: d3 call
        .call((d3ZoomInstance as ReturnType<typeof import("d3")["zoom"]>).scaleBy, 1.3);
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!d3ZoomInstance || !d3Selection || !containerRef.current) return;
    import("d3").then(({ select }) => {
      const container = select(containerRef.current!);
      (container as ReturnType<typeof import("d3")["select"]>)
        .transition()
        .duration(200)
        // biome-ignore lint: d3 call
        .call((d3ZoomInstance as ReturnType<typeof import("d3")["zoom"]>).scaleBy, 0.77);
    });
  }, []);

  const handleZoomFit = useCallback(() => {
    if (!svgWrapperRef.current || !containerRef.current || !d3ZoomInstance) return;
    const svgEl = svgWrapperRef.current.querySelector("svg");
    if (!svgEl) return;
    import("d3").then(({ select, zoomIdentity }) => {
      const container = select(containerRef.current!);
      zoomToFit(
        svgEl as SVGElement,
        containerRef.current!,
        d3ZoomInstance as ReturnType<typeof import("d3")["zoom"]>,
        container as ReturnType<typeof import("d3")["select"]>,
        zoomIdentity
      );
    });
  }, []);

  const handleZoomReset = useCallback(() => {
    if (!d3ZoomInstance || !containerRef.current) return;
    import("d3").then(({ select, zoomIdentity }) => {
      const container = select(containerRef.current!);
      (container as ReturnType<typeof import("d3")["select"]>)
        .transition()
        .duration(300)
        // biome-ignore lint: d3 call
        .call((d3ZoomInstance as ReturnType<typeof import("d3")["zoom"]>).transform, zoomIdentity);
      setZoom(100);
    });
  }, []);

  // Re-render when code/theme changes
  useEffect(() => {
    renderDiagram();
  }, [renderDiagram]);

  return (
    <div className="graph-canvas-wrapper relative flex flex-col h-full bg-canvas overflow-hidden">
      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
        style={{ background: "var(--canvas-bg)" }}
      >
        {/* Grid background */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: `
            radial-gradient(circle, rgba(0,210,255,0.07) 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px",
        }} />

        {/* SVG container */}
        <div
          ref={svgWrapperRef}
          className="absolute inset-0 flex items-center justify-center"
          style={{ pointerEvents: "none" }}
        />

        {/* Render error overlay */}
        {state.renderError && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-red-900/80 border border-red-500/60 rounded-lg p-6 max-w-lg backdrop-blur-sm">
              <p className="text-red-300 text-sm font-mono mb-1 font-bold">⚠ Render Error</p>
              <p className="text-red-200 text-xs font-mono whitespace-pre-wrap leading-relaxed">
                {state.renderError}
              </p>
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {state.isRendering && (
          <div className="absolute top-4 right-4 flex items-center gap-2 bg-surface/80 rounded-full px-3 py-1.5 backdrop-blur-sm border border-cyan-500/20">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs text-cyan-400 font-mono">Rendering…</span>
          </div>
        )}
      </div>

      {/* Zoom Controls */}
      <div className="absolute bottom-20 right-4 flex flex-col gap-1 z-10">
        <Button
          size="icon"
          variant="ghost"
          onClick={handleZoomIn}
          className="w-8 h-8 bg-surface/80 border border-border/50 backdrop-blur-sm text-muted-foreground hover:text-cyan-400 hover:border-cyan-500/50"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleZoomOut}
          className="w-8 h-8 bg-surface/80 border border-border/50 backdrop-blur-sm text-muted-foreground hover:text-cyan-400 hover:border-cyan-500/50"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleZoomFit}
          className="w-8 h-8 bg-surface/80 border border-border/50 backdrop-blur-sm text-muted-foreground hover:text-cyan-400 hover:border-cyan-500/50"
          title="Fit to Screen"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleZoomReset}
          className="w-8 h-8 bg-surface/80 border border-border/50 backdrop-blur-sm text-muted-foreground hover:text-amber-400 hover:border-amber-500/50"
          title="Reset Zoom"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Zoom badge */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10">
        <span className="bg-surface/70 border border-border/40 text-muted-foreground text-xs font-mono px-2 py-0.5 rounded backdrop-blur-sm">
          {zoom}%
        </span>
      </div>

      {/* Minimap */}
      {state.minimapOpen && (
        <Minimap
          svgWrapperRef={svgWrapperRef}
          containerRef={containerRef}
          zoomLevel={zoom}
          onNavigate={(relX, relY) => {
            if (!d3ZoomInstance || !containerRef.current || !svgWrapperRef.current) return;
            const svgEl = svgWrapperRef.current.querySelector("svg");
            if (!svgEl) return;
            import("d3").then(({ select, zoomIdentity }) => {
              const container = select(containerRef.current!);
              const containerRect = containerRef.current!.getBoundingClientRect();
              // Pan to the relative position
              const tx = -relX * containerRect.width * 0.5 + containerRect.width * 0.3;
              const ty = -relY * containerRect.height * 0.5 + containerRect.height * 0.3;
              container
                .transition()
                .duration(300)
                .call(d3ZoomInstance.transform, zoomIdentity.translate(tx, ty).scale(zoom / 100));
            });
          }}
        />
      )}
    </div>
  );
}