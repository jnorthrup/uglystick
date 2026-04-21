"use client";
// ─────────────────────────────────────────────────────────────────────────────
// GRAPHIQUE 2026 — Main App Shell
// ─────────────────────────────────────────────────────────────────────────────

import dynamic from "next/dynamic";
import { useGraphique } from "@/store/graphique-store";
import type { DockPosition } from "@/lib/storage";
import Toolbar from "./Toolbar";
import StatusBar from "./StatusBar";
import DetachablePanel from "./DetachablePanel";

// Dynamic imports for heavy components
const GraphCanvas = dynamic(() => import("./GraphCanvas"), { ssr: false });
const CodeEditor = dynamic(() => import("./CodeEditor"), { ssr: false });
const PropertiesPanel = dynamic(() => import("./PropertiesPanel"), { ssr: false });
const LLMPanel = dynamic(() => import("./LLMPanel"), { ssr: false });

export default function GraphiqueApp() {
  const { state, dispatch } = useGraphique();

  const editorPos = state.panelPositions?.editor ?? "bottom";
  const propertiesPos = state.panelPositions?.properties ?? "right";
  const llmPos = state.panelPositions?.llm ?? "right";

  const handlePanelPositionChange = (panelId: string, position: DockPosition) => {
    dispatch({ type: "SET_PANEL_POSITION", panelId, position });
  };

  // Determine which panels are in which dock zone
  const leftPanels: { id: string; pos: DockPosition; element: React.ReactNode }[] = [];
  const rightPanels: { id: string; pos: DockPosition; element: React.ReactNode }[] = [];
  const bottomPanels: { id: string; pos: DockPosition; element: React.ReactNode }[] = [];

  if (state.propertiesOpen) {
    const panel = {
      id: "properties",
      pos: propertiesPos,
      element: (
        <DetachablePanel
          panelId="properties"
          position={propertiesPos}
          onPositionChange={handlePanelPositionChange}
          onClose={() => dispatch({ type: "TOGGLE_PROPERTIES" })}
        >
          <PropertiesPanel />
        </DetachablePanel>
      ),
    };
    if (propertiesPos === "left") leftPanels.push(panel);
    else if (propertiesPos === "bottom") bottomPanels.push(panel);
    else rightPanels.push(panel);
  }

  if (state.llmOpen) {
    const panel = {
      id: "llm",
      pos: llmPos,
      element: (
        <DetachablePanel
          panelId="llm"
          position={llmPos}
          onPositionChange={handlePanelPositionChange}
          onClose={() => dispatch({ type: "TOGGLE_LLM" })}
        >
          <LLMPanel />
        </DetachablePanel>
      ),
    };
    if (llmPos === "left") leftPanels.push(panel);
    else if (llmPos === "bottom") bottomPanels.push(panel);
    else rightPanels.push(panel);
  }

  if (state.editorOpen) {
    const panel = {
      id: "editor",
      pos: editorPos,
      element: (
        <DetachablePanel
          panelId="editor"
          position={editorPos}
          onPositionChange={handlePanelPositionChange}
          onClose={() => dispatch({ type: "TOGGLE_EDITOR" })}
        >
          <CodeEditor />
        </DetachablePanel>
      ),
    };
    if (editorPos === "left") leftPanels.push(panel);
    else if (editorPos === "bottom") bottomPanels.push(panel);
    else rightPanels.push(panel);
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background font-jetbrains">
      {/* Top Toolbar */}
      <Toolbar />

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left sidebar panels */}
        {leftPanels.length > 0 && (
          <div className="flex flex-col shrink-0 overflow-hidden border-r border-border/40">
            {leftPanels.map((p) => (
              <div key={p.id} className="flex-1 min-h-0 shrink-0">
                {p.element}
              </div>
            ))}
          </div>
        )}

        {/* Center: Canvas + bottom-docked panels */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Canvas (takes available space) */}
          <div className="flex-1 min-h-0 relative overflow-hidden">
            <GraphCanvas />
          </div>

          {/* Bottom-docked panels */}
          {bottomPanels.length > 0 && (
            <div className="shrink-0 flex flex-col overflow-hidden">
              {bottomPanels.map((p) => (
                <div key={p.id} className="shrink-0 overflow-hidden">
                  {p.element}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar panels */}
        {rightPanels.length > 0 && (
          <div className="flex flex-col shrink-0 overflow-hidden border-l border-border/40">
            {rightPanels.map((p) => (
              <div key={p.id} className="flex-1 min-h-0 shrink-0">
                {p.element}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status Bar */}
      <StatusBar />
    </div>
  );
}
