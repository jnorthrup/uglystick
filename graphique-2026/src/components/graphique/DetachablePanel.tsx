"use client";
// ─────────────────────────────────────────────────────────────────────────────
// GRAPHIQUE 2026 — Detachable Panel (drag, snap-to-edge, resize)
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useRef, useState, useEffect } from "react";
import { GripVertical, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type DockPosition = "right" | "bottom" | "left" | "floating";

interface DetachablePanelProps {
  panelId: string;
  position: DockPosition;
  width?: number;
  height?: number;
  onPositionChange: (id: string, position: DockPosition) => void;
  onClose?: () => void;
  children: React.ReactNode;
}

// Snap thresholds (fraction of viewport)
const SNAP_LEFT = 0.25;
const SNAP_RIGHT = 0.75;
const SNAP_BOTTOM = 0.75;

// Resize bounds
const MIN_WIDTH = 200;
const MAX_WIDTH = 600;
const MIN_HEIGHT = 200;
const MAX_HEIGHT = 500;

// Drop-zone overlay threshold
const DROP_ZONE_THRESHOLD = 0.15;

export default function DetachablePanel({
  panelId,
  position,
  width = 256,
  height = 280,
  onPositionChange,
  onClose,
  children,
}: DetachablePanelProps) {
  const [panelWidth, setPanelWidth] = useState(width);
  const [panelHeight, setPanelHeight] = useState(height);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dropZone, setDropZone] = useState<DockPosition | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const dragRef = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Drag handlers ──────────────────────────────────────────────────────

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const rect = panelRef.current?.getBoundingClientRect();
      if (!rect) return;

      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
      };
      setIsDragging(true);
    },
    []
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setDragOffset({ x: dx, y: dy });

      // Determine drop zone
      const xRatio = e.clientX / window.innerWidth;
      const yRatio = e.clientY / window.innerHeight;

      if (xRatio < DROP_ZONE_THRESHOLD) {
        setDropZone("left");
      } else if (xRatio > 1 - DROP_ZONE_THRESHOLD) {
        setDropZone("right");
      } else if (yRatio > 1 - DROP_ZONE_THRESHOLD) {
        setDropZone("bottom");
      } else {
        setDropZone(null);
      }
    };

    const handleMouseUp = () => {
      if (!dragRef.current) return;
      const endX = dragRef.current.startX + dragOffset.x;
      const endY = dragRef.current.startY + dragOffset.y;
      const xRatio = endX / window.innerWidth;
      const yRatio = endY / window.innerHeight;

      let target: DockPosition = position;
      if (xRatio < SNAP_LEFT) {
        target = "left";
      } else if (xRatio > SNAP_RIGHT) {
        target = "right";
      } else if (yRatio > SNAP_BOTTOM) {
        target = "bottom";
      }

      if (target !== position) {
        onPositionChange(panelId, target);
      }

      setIsDragging(false);
      setDragOffset({ x: 0, y: 0 });
      setDropZone(null);
      dragRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset, panelId, position, onPositionChange]);

  // ── Resize handlers ────────────────────────────────────────────────────

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startWidth: panelWidth,
        startHeight: panelHeight,
      };
      setIsResizing(true);
    },
    [panelWidth, panelHeight]
  );

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const dx = e.clientX - resizeRef.current.startX;
      const dy = e.clientY - resizeRef.current.startY;

      if (position === "bottom") {
        setPanelHeight((prev) =>
          Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, prev - dy))
        );
      } else if (position === "left") {
        setPanelWidth((prev) =>
          Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, prev + dx))
        );
      } else {
        // right
        setPanelWidth((prev) =>
          Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, prev - dx))
        );
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, position]);

  // ── Collapse toggle ────────────────────────────────────────────────────

  const handleCollapse = useCallback(() => {
    setCollapsed((c) => !c);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={handleCollapse}
        className={`flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-muted-foreground hover:text-cyan-400 bg-surface/80 border border-border/40 rounded transition-colors ${
          position === "bottom"
            ? "fixed bottom-8 right-4"
            : position === "left"
            ? "fixed top-16 left-1"
            : "fixed top-16 right-1"
        }`}
        title={`Expand ${panelId}`}
      >
        {position === "bottom" ? <ChevronUp className="w-3 h-3" /> : position === "left" ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        {panelId}
      </button>
    );
  }

  const isVertical = position === "bottom";

  return (
    <>
      {/* Drop-zone overlay */}
      {isDragging && dropZone && (
        <div
          className={`fixed pointer-events-none bg-cyan-500/10 border-2 border-dashed border-cyan-400/50 z-40 transition-all duration-150 ${
            dropZone === "left"
              ? "left-0 top-0 bottom-0 w-1/4"
              : dropZone === "right"
              ? "right-0 top-0 bottom-0 w-1/4"
              : "bottom-0 left-0 right-0 h-1/4"
          }`}
        />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        className={`flex flex-col bg-panel border-border/40 shrink-0 overflow-hidden transition-all duration-200 ease-out ${
          isDragging ? "opacity-80 shadow-2xl z-50" : ""
        } ${
          position === "bottom"
            ? "border-t w-full"
            : position === "left"
            ? "border-r"
            : "border-l"
        }`}
        style={{
          width: isVertical ? "100%" : `${panelWidth}px`,
          height: isVertical ? `${panelHeight}px` : "100%",
          transform: isDragging
            ? `translate(${dragOffset.x}px, ${dragOffset.y}px)`
            : "none",
        }}
      >
        {/* Drag handle / header bar */}
        <div
          className={`flex items-center justify-between px-2 py-1.5 border-b border-border/20 bg-panel-header/80 shrink-0 select-none ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          onMouseDown={handleDragStart}
        >
          <div className="flex items-center gap-1.5">
            <GripVertical className="w-3 h-3 text-muted-foreground/50" />
            <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">
              {panelId}
            </span>
          </div>

          <div className="flex items-center gap-0.5">
            {/* Collapse */}
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleCollapse();
              }}
              className="w-5 h-5 text-muted-foreground/50 hover:text-muted-foreground"
              title="Collapse"
            >
              {isVertical ? (
                <ChevronDown className="w-3 h-3" />
              ) : position === "left" ? (
                <ChevronLeft className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </Button>

            {/* Close */}
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="w-5 h-5 text-muted-foreground/40 hover:text-muted-foreground"
                title="Close"
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Resize handle */}
        <div
          className={`shrink-0 flex items-center justify-center bg-panel-header/40 hover:bg-cyan-500/10 transition-colors ${
            isVertical
              ? "h-1.5 cursor-n-resize border-b border-border/20"
              : position === "left"
              ? "w-1.5 cursor-e-resize border-r border-border/20"
              : "w-1.5 cursor-w-resize border-l border-border/20"
          }`}
          onMouseDown={handleResizeStart}
        >
          <div className={`bg-muted-foreground/30 rounded-full ${isVertical ? "w-8 h-0.5" : "w-0.5 h-8"}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      </div>
    </>
  );
}
