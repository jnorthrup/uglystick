"use client";
// ─────────────────────────────────────────────────────────────────────────────
// GRAPHIQUE 2026 — Main App Shell
// ─────────────────────────────────────────────────────────────────────────────

import dynamic from "next/dynamic";
import { useGraphique } from "@/store/graphique-store";
import Toolbar from "./Toolbar";
import StatusBar from "./StatusBar";

// Dynamic imports for heavy components
const GraphCanvas = dynamic(() => import("./GraphCanvas"), { ssr: false });
const CodeEditor = dynamic(() => import("./CodeEditor"), { ssr: false });
const PropertiesPanel = dynamic(() => import("./PropertiesPanel"), { ssr: false });
const LLMPanel = dynamic(() => import("./LLMPanel"), { ssr: false });

export default function GraphiqueApp() {
  const { state } = useGraphique();

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background font-jetbrains">
      {/* Top Toolbar */}
      <Toolbar />

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Canvas + Editor (stacked vertically) */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Canvas (takes available space) */}
          <div className="flex-1 min-h-0 relative overflow-hidden">
            <GraphCanvas />
          </div>

          {/* Code Editor Panel (collapsible bottom) */}
          {state.editorOpen && (
            <div
              className="shrink-0 border-t border-border/40 overflow-hidden"
              style={{ height: "280px" }}
            >
              <CodeEditor />
            </div>
          )}
        </div>

        {/* Right Panels */}
        <div className="flex shrink-0 overflow-hidden">
          {/* Properties Panel */}
          {state.propertiesOpen && (
            <PropertiesPanel />
          )}

          {/* LLM Panel */}
          {state.llmOpen && (
            <LLMPanel />
          )}
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar />
    </div>
  );
}