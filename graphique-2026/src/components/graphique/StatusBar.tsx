"use client";
// ─────────────────────────────────────────────────────────────────────────────
// GRAPHIQUE 2026 — Status Bar
// ─────────────────────────────────────────────────────────────────────────────

import { useGraphique } from "@/store/graphique-store";
import { LAYOUT_LABELS } from "@/lib/graph/types";
import {
  Circle,
  Network,
  GitBranch,
  LayoutDashboard,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

export default function StatusBar() {
  const { state } = useGraphique();

  const errorCount = state.diagnostics.filter((d) => d.severity === "error").length;
  const warnCount = state.diagnostics.filter((d) => d.severity === "warning").length;

  return (
    <div className="flex items-center h-6 px-3 gap-4 border-t border-border/30 bg-statusbar shrink-0 select-none overflow-hidden">
      {/* Left side */}
      <div className="flex items-center gap-3">
        {/* Render status */}
        <div className="flex items-center gap-1.5">
          {state.isRendering ? (
            <Loader2 className="w-2.5 h-2.5 text-cyan-400 animate-spin" />
          ) : errorCount > 0 ? (
            <Circle className="w-2 h-2 fill-red-500 text-red-500" />
          ) : (
            <Circle className="w-2 h-2 fill-green-500 text-green-500" />
          )}
          <span className="text-[10px] font-mono text-muted-foreground/70">
            {state.isRendering
              ? "Rendering…"
              : errorCount > 0
              ? "Error"
              : "Ready"}
          </span>
        </div>

        {/* Diagnostics */}
        {errorCount > 0 && (
          <div className="flex items-center gap-1 text-red-400">
            <AlertCircle className="w-2.5 h-2.5" />
            <span className="text-[10px] font-mono">{errorCount} error{errorCount !== 1 ? "s" : ""}</span>
          </div>
        )}
        {warnCount > 0 && (
          <div className="flex items-center gap-1 text-amber-400">
            <AlertCircle className="w-2.5 h-2.5" />
            <span className="text-[10px] font-mono">{warnCount} warning{warnCount !== 1 ? "s" : ""}</span>
          </div>
        )}
        {errorCount === 0 && warnCount === 0 && (
          <div className="flex items-center gap-1 text-green-400">
            <CheckCircle2 className="w-2.5 h-2.5" />
            <span className="text-[10px] font-mono">No issues</span>
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side: stats */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 text-muted-foreground/50">
          <Network className="w-2.5 h-2.5" />
          <span className="text-[10px] font-mono">Nodes: {state.nodeCount}</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground/50">
          <GitBranch className="w-2.5 h-2.5" />
          <span className="text-[10px] font-mono">Edges: {state.edgeCount}</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground/50">
          <LayoutDashboard className="w-2.5 h-2.5" />
          <span className="text-[10px] font-mono">{LAYOUT_LABELS[state.layout]}</span>
        </div>
        <div className="text-[10px] font-mono text-muted-foreground/50 uppercase">
          {state.format}
        </div>
        <div className="text-[10px] font-mono text-cyan-500/50 capitalize">
          {state.theme}
        </div>
      </div>
    </div>
  );
}