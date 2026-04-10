"use client";
// ─────────────────────────────────────────────────────────────────────────────
// GRAPHIQUE 2026 — Properties Panel
// ─────────────────────────────────────────────────────────────────────────────

import { useGraphique } from "@/store/graphique-store";
import { LAYOUT_LABELS } from "@/lib/graph/types";
import {
  Network,
  GitBranch,
  Triangle,
  AlertCircle,
  CheckCircle2,
  Info,
  Lightbulb,
} from "lucide-react";

function DiagnosticRow({
  severity,
  code,
  message,
}: {
  severity: string;
  code: string;
  message: string;
}) {
  const icon =
    severity === "error" ? (
      <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
    ) : severity === "warning" ? (
      <Triangle className="w-3 h-3 text-amber-400 shrink-0" />
    ) : severity === "info" ? (
      <Info className="w-3 h-3 text-blue-400 shrink-0" />
    ) : (
      <Lightbulb className="w-3 h-3 text-purple-400 shrink-0" />
    );

  return (
    <div className="flex items-start gap-2 py-1.5 px-2 border-b border-border/10 hover:bg-surface/50">
      {icon}
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] font-mono text-muted-foreground/50">{code}</span>
        <span className="text-xs text-muted-foreground leading-snug">{message}</span>
      </div>
    </div>
  );
}

export default function PropertiesPanel() {
  const { state, dispatch } = useGraphique();

  const errorCount = state.diagnostics.filter((d) => d.severity === "error").length;
  const warnCount = state.diagnostics.filter((d) => d.severity === "warning").length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Content area - header removed since DetachablePanel provides it */}
      <div className="flex-1 overflow-y-auto">
        {/* Graph Info */}
        <div className="p-3 border-b border-border/30">
          <p className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider mb-2">
            Graph Info
          </p>
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Network className="w-3 h-3" /> Nodes
              </span>
              <span className="text-xs font-mono text-cyan-400">{state.nodeCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <GitBranch className="w-3 h-3" /> Edges
              </span>
              <span className="text-xs font-mono text-cyan-400">{state.edgeCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Format</span>
              <span className="text-xs font-mono text-amber-400 uppercase">{state.format}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Layout</span>
              <span className="text-xs font-mono text-foreground/70">
                {LAYOUT_LABELS[state.layout]}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Direction</span>
              <span className="text-xs font-mono text-foreground/70">{state.direction}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Theme</span>
              <span className="text-xs font-mono text-foreground/70 capitalize">{state.theme}</span>
            </div>
          </div>
        </div>

        {/* Code Stats */}
        <div className="p-3 border-b border-border/30">
          <p className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider mb-2">
            Code Stats
          </p>
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Lines</span>
              <span className="text-xs font-mono text-foreground/70">
                {state.code.split("\n").length}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Characters</span>
              <span className="text-xs font-mono text-foreground/70">{state.code.length}</span>
            </div>
          </div>
        </div>

        {/* Diagnostics */}
        <div className="p-3 border-b border-border/30">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">
              Diagnostics
            </p>
            {state.diagnostics.length === 0 ? (
              <div className="flex items-center gap-1 text-green-400">
                <CheckCircle2 className="w-3 h-3" />
                <span className="text-[10px] font-mono">No issues</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {errorCount > 0 && (
                  <span className="text-[10px] font-mono text-red-400">{errorCount} err</span>
                )}
                {warnCount > 0 && (
                  <span className="text-[10px] font-mono text-amber-400">{warnCount} warn</span>
                )}
              </div>
            )}
          </div>
        </div>

        {state.diagnostics.length > 0 && (
          <div>
            {state.diagnostics.map((d, i) => (
              <DiagnosticRow
                key={`${d.code}-${i}`}
                severity={d.severity}
                code={d.code}
                message={d.message}
              />
            ))}
          </div>
        )}

        {/* Layout Options */}
        <div className="p-3">
          <p className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider mb-2">
            Layout Options
          </p>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Direction</label>
              <div className="grid grid-cols-4 gap-1">
                {(["TB", "LR", "BT", "RL"] as const).map((dir) => (
                  <button
                    key={dir}
                    type="button"
                    onClick={() => dispatch({ type: "SET_DIRECTION", direction: dir })}
                    className={`text-[10px] font-mono py-1 rounded border transition-colors ${
                      state.direction === dir
                        ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-400"
                        : "border-border/40 text-muted-foreground/60 hover:text-cyan-400 hover:border-cyan-500/30"
                    }`}
                  >
                    {dir}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}