"use client";
// ─────────────────────────────────────────────────────────────────────────────
// GRAPHIQUE 2026 — Minimap (canvas-based, lightweight overview)
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback, useState } from "react";
import { Map as MapIcon } from "lucide-react";

interface MinimapProps {
  svgWrapperRef: React.RefObject<HTMLDivElement>;
  onNavigate: (relativeX: number, relativeY: number) => void;
  width?: number;
  height?: number;
}

export default function Minimap({
  svgWrapperRef,
  onNavigate,
  width = 200,
  height = 130,
}: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const renderCountRef = useRef(0);

  // Poll for SVG changes every 2s (keeps minimap in sync without thrashing blob URLs)
  useEffect(() => {
    let cancelled = false;

    const renderMinimap = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      const svgEl = svgWrapperRef.current?.querySelector("svg");
      if (!canvas || !svgEl) return;

      const renderId = ++renderCountRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const svgRect = svgEl.getBoundingClientRect();
      if (!svgRect.width || !svgRect.height) return;

      // Clone SVG and ensure proper namespace
      const clone = svgEl.cloneNode(true) as SVGElement;
      clone.setAttribute("width", String(svgRect.width));
      clone.setAttribute("height", String(svgRect.height));
      if (!clone.getAttribute("xmlns")) {
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      }
      // Ensure text elements have visible fill
      const textNodes = clone.querySelectorAll("text");
      for (const node of textNodes) {
        if (!node.getAttribute("fill")) node.setAttribute("fill", "#cdd6f4");
      }

      const svgData = new XMLSerializer().serializeToString(clone);
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        if (renderId !== renderCountRef.current || cancelled) { URL.revokeObjectURL(url); return; }
        const availH = height - 24;
        ctx.clearRect(0, 0, width, availH);
        ctx.fillStyle = "rgba(13, 17, 23, 0.9)";
        ctx.fillRect(0, 0, width, availH);

        const scale = Math.min(width / svgRect.width, availH / svgRect.height, 1);
        const drawW = svgRect.width * scale;
        const drawH = svgRect.height * scale;
        const ox = (width - drawW) / 2;
        const oy = (availH - drawH) / 2;
        ctx.drawImage(img, ox, oy, drawW, drawH);
        URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        if (cancelled) return;
        URL.revokeObjectURL(url);
        // Fallback: draw a simple indicator
        const availH = height - 24;
        ctx.clearRect(0, 0, width, availH);
        ctx.fillStyle = "rgba(13, 17, 23, 0.9)";
        ctx.fillRect(0, 0, width, availH);
        ctx.fillStyle = "#6b7280";
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText("Rendering…", width / 2, availH / 2);
      };
      img.src = url;
    };

    renderMinimap();
    const interval = setInterval(renderMinimap, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [svgWrapperRef, width, height]);

  // Handle click to navigate
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
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
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
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
        <MapIcon className="w-2.5 h-2.5 text-cyan-400" />
        <span className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-wider">
          Minimap
        </span>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height - 24}
        className="cursor-pointer block"
        onClick={handleClick}
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}
