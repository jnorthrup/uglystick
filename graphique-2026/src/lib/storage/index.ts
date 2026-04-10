// ─────────────────────────────────────────────────────────────────────────────
// GRAPHIQUE 2026 — LocalStorage Manager
// ─────────────────────────────────────────────────────────────────────────────

import type { DiagramFormat, LayoutAlgorithm, GraphiqueTheme } from "../graph/types";

export interface SavedDiagram {
  id: string;
  title: string;
  code: string;
  format: DiagramFormat;
  layout: LayoutAlgorithm;
  createdAt: string;
  updatedAt: string;
}

export type DockPosition = "right" | "bottom" | "left";

export interface AppState {
  currentCode: string;
  currentFormat: DiagramFormat;
  currentLayout: LayoutAlgorithm;
  currentTheme: GraphiqueTheme;
  llmProvider: string;
  llmModel: string;
  editorPanelOpen: boolean;
  propertiesPanelOpen: boolean;
  minimapOpen: boolean;
  llmPanelOpen: boolean;
  panelPositions: Record<string, DockPosition>;
}

const STATE_KEY = "graphique_app_state";
const DIAGRAMS_KEY = "graphique_diagrams";

export function saveAppState(state: Partial<AppState>): void {
  if (typeof window === "undefined") return;
  try {
    const current = loadAppState();
    localStorage.setItem(STATE_KEY, JSON.stringify({ ...current, ...state }));
  } catch {}
}

export function loadAppState(): AppState {
  const defaults: AppState = {
    currentCode: `graph TD
    A([Start]) --> B{Decision}
    B -->|Yes| C[Process Alpha]
    B -->|No| D[Process Beta]
    C --> E[(Database)]
    D --> E
    E --> F{Valid?}
    F -->|Valid| G[/Output/]
    F -->|Invalid| H[Error Handler]
    H --> B
    G --> I([End])

    style A fill:#00D2FF,stroke:#0099BB,color:#000
    style I fill:#FFB347,stroke:#CC8800,color:#000
    style E fill:#6A5ACD,stroke:#483D8B,color:#fff`,
    currentFormat: "mermaid",
    currentLayout: "hierarchical",
    currentTheme: "dark",
    llmProvider: "openai",
    llmModel: "gpt-4o",
    editorPanelOpen: true,
    propertiesPanelOpen: true,
    minimapOpen: true,
    llmPanelOpen: false,
    panelPositions: {
      editor: "bottom",
      properties: "right",
      llm: "right",
    },
  };

  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

export function saveDiagram(diagram: SavedDiagram): void {
  if (typeof window === "undefined") return;
  try {
    const diagrams = loadDiagrams();
    const idx = diagrams.findIndex((d) => d.id === diagram.id);
    if (idx >= 0) {
      diagrams[idx] = diagram;
    } else {
      diagrams.unshift(diagram);
    }
    // Keep at most 50 diagrams
    const trimmed = diagrams.slice(0, 50);
    localStorage.setItem(DIAGRAMS_KEY, JSON.stringify(trimmed));
  } catch {}
}

export function loadDiagrams(): SavedDiagram[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DIAGRAMS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function deleteDiagram(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const diagrams = loadDiagrams().filter((d) => d.id !== id);
    localStorage.setItem(DIAGRAMS_KEY, JSON.stringify(diagrams));
  } catch {}
}