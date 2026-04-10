"use client";
// ─────────────────────────────────────────────────────────────────────────────
// GRAPHIQUE 2026 — Minimap (overview thumbnail with viewport indicator)
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback, useState } from "react";
import { Map } from "lucide-react";

interface MinimapProps {
  svgWrapperRef: React.RefObject<HTMLDivElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  zoomLevel: number;
  onNavigate: (relativeX: number, relativeY: number) => void;
  width?: number;
  height?: number;
}

export default function Minimap({
  svgWrapperRef,
  containerRef,
  onNavigate,
  width = 200,
  height = 130,
}: MinimapProps) {
  const minimapRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Clone SVG from main canvas into minimap
  useEffect(() => {
    if (!minimapRef.current || !svgWrapperRef.current) return;

    const svg = svgWrapperRef.current.querySelector("svg");
    if (!svg) return;

    const cloned = svg.cloneNode(true) as SVGElement;

    // Strip interactive attributes and set fixed size for minimap
    cloned.removeAttribute("id");
    cloned.removeAttribute("class");
    cloned.style.width = `${width}px`;
    cloned.style.height = `${height}px`;
    cloned.style.pointerEvents = "none";
    cloned.style.transform = "none";

    // Make it semi-transparent for overview feel
    cloned.style.opacity = "0.7";

    minimapRef.current.innerHTML = "";
    minimapRef.current.appendChild(cloned);
  }, [svgWrapperRef, width, height]);

  // Compute viewport indicator position
  const computeViewportRect = useCallback(() => {
    if (!containerRef.current) return null;

    const containerRect = containerRef.current.getBoundingClientRect();
    const svgEl = svgWrapperRef.current?.querySelector("svg");
    if (!svgEl) return null;

    const svgRect = svgEl.getBoundingClientRect();

    // Calculate visible portion relative to the full SVG
    const scale = containerRect.width / (svgRect.width || 1);
    const visibleWidth = containerRect.width;
    const visibleHeight = containerRect.height;

    // Get current transform
    const transform = svgEl.style.transform || "";
    const translateMatch = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
    const scaleMatch = transform.match(/scale\(([-\d.]+)\)/);
    const tx = translateMatch ? parseFloat(translateMatch[1]) : 0;
    const ty = translateMatch ? parseFloat(translateMatch[2]) : 0;
    const k = scaleMatch ? parseFloat(scaleMatch[1]) : 1;

    // SVG dimensions at original scale
    const svgW = svgRect.width / k;
    const svgH = svgRect.height / k;

    // Viewport rect in minimap coordinates
    const minX = -tx / k;
    const minY = -ty / k;
    const viewW = containerRect.width / k;
    const viewH = containerRect.height / k;

    const miniX = (minX / svgW) * width;
    const miniY = (minY / svgH) * height;
    const miniW = Math.min((viewW / svgW) * width, width);
    const miniH = Math.min((viewH / svgH) * height, height);

    return {
      x: Math.max(0, miniX),
      y: Math.max(0, miniY),
      w: Math.min(miniW, width - miniX),
      h: Math.min(miniH, height - miniY),
    };
  }, [containerRef, svgWrapperRef, width, height]);

  const [viewportRect, setViewportRect] = useState<ReturnType<typeof computeViewportRect>>(null);

  // Update viewport rect periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setViewportRect(computeViewportRect());
    }, 200);
    return () => clearInterval(interval);
  }, [computeViewportRect]);

  // Handle click to navigate
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!minimapRef.current) return;
      const rect = minimapRef.current.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      const relY = (e.clientY - rect.top) / rect.height;
      onNavigate(Math.max(0, Math.min(1, relX)), Math.max(0, Math.min(1, relY)));
    },
    [onNavigate]
  );

  // Handle drag to navigate
  const handleMouseDown = useCallback(() => setIsDragging(true), []);
  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!minimapRef.current) return;
      const rect = minimapRef.current.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      const relY = (e.clientY - rect.top) / rect.height;
      onNavigate(Math.max(0, Math.min(1, relX)), Math.max(0, Math.min(1, relY)));
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, onNavigate, handleMouseUp]);

  return (
    <div
      className="absolute bottom-20 left-4 z-10 rounded-lg overflow-hidden border border-border/40 bg-surface/80 backdrop-blur-sm shadow-md"
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      {/* Header */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-border/30 bg-panel-header">
        <Map className="w-2.5 h-2.5 text-cyan-400" />
        <span className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-wider">
          Minimap
        </span>
      </div>

      {/* SVG container */}
      <div
        ref={minimapRef}
        className="relative w-full overflow-hidden cursor-pointer"
        style={{ height: `${height - 24}px` }}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
      />

      {/* Viewport indicator */}
      {viewportRect && (
        <div
          className="absolute pointer-events-none border border-cyan-400/60 bg-cyan-400/5 rounded-sm"
          style={{
            left: `${24 + viewportRect.x}px`,
            top: `${24 + viewportRect.y}px`,
            width: `${viewportRect.w}px`,
            height: `${viewportRect.h}px`,
            transition: isDragging ? "none" : "left 0.1s, top 0.1s, width 0.1s, height 0.1s",
          }}
        />
      )}
    </div>
  );
}
