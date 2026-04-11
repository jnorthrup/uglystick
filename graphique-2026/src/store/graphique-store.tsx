"use client";
// ─────────────────────────────────────────────────────────────────────────────
// GRAPHIQUE 2026 — Global App State (React Context + useReducer)
// ─────────────────────────────────────────────────────────────────────────────

import type React from "react";
import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
} from "react";
import type { DiagramFormat, LayoutAlgorithm, GraphiqueTheme, IDiagnostic } from "../lib/graph/types";
import { LLM_PROVIDERS } from "../lib/graph/types";
import type { DockPosition } from "../lib/storage";
import { loadAppState, saveAppState } from "../lib/storage";

// ─────────────────────────────── State ───────────────────────────────────────

export interface GraphiqueState {
  // Editor
  code: string;
  format: DiagramFormat;

  // Layout & Theme
  layout: LayoutAlgorithm;
  direction: "TB" | "BT" | "LR" | "RL";
  theme: GraphiqueTheme;

  // UI Panels
  editorOpen: boolean;
  propertiesOpen: boolean;
  minimapOpen: boolean;
  llmOpen: boolean;
  panelPositions: Record<string, DockPosition>;

  // Selection
  selectedNodeIds: Set<string>;

  // Diagnostics
  diagnostics: IDiagnostic[];
  renderError: string | null;

  // LLM
  llmProvider: string;
  llmModel: string;
  llmLoading: boolean;
  llmChat: { role: "user" | "assistant"; content: string; ts: number }[];

  // Graph stats (computed by renderer)
  nodeCount: number;
  edgeCount: number;

  // Render state
  isRendering: boolean;
}

// ─────────────────────────────── Actions ─────────────────────────────────────

type Action =
  | { type: "SET_CODE"; code: string }
  | { type: "SET_FORMAT"; format: DiagramFormat }
  | { type: "SET_LAYOUT"; layout: LayoutAlgorithm }
  | { type: "SET_DIRECTION"; direction: "TB" | "BT" | "LR" | "RL" }
  | { type: "SET_THEME"; theme: GraphiqueTheme }
  | { type: "TOGGLE_EDITOR" }
  | { type: "TOGGLE_PROPERTIES" }
  | { type: "TOGGLE_MINIMAP" }
  | { type: "TOGGLE_LLM" }
  | { type: "SET_PANEL_POSITION"; panelId: string; position: DockPosition }
  | { type: "SET_SELECTED_NODES"; ids: Set<string> }
  | { type: "SET_DIAGNOSTICS"; diagnostics: IDiagnostic[] }
  | { type: "SET_RENDER_ERROR"; error: string | null }
  | { type: "SET_LLM_PROVIDER"; provider: string }
  | { type: "SET_LLM_MODEL"; model: string }
  | { type: "SET_LLM_LOADING"; loading: boolean }
  | { type: "ADD_LLM_MESSAGE"; role: "user" | "assistant"; content: string }
  | { type: "CLEAR_LLM_CHAT" }
  | { type: "SET_GRAPH_STATS"; nodeCount: number; edgeCount: number }
  | { type: "SET_IS_RENDERING"; rendering: boolean }
  | { type: "LOAD_STATE"; state: Partial<GraphiqueState> };

// ─────────────────────────────── Reducer ─────────────────────────────────────

function reducer(state: GraphiqueState, action: Action): GraphiqueState {
  switch (action.type) {
    case "SET_CODE":
      return { ...state, code: action.code };
    case "SET_FORMAT":
      return { ...state, format: action.format };
    case "SET_LAYOUT":
      return { ...state, layout: action.layout };
    case "SET_DIRECTION":
      return { ...state, direction: action.direction };
    case "SET_THEME":
      return { ...state, theme: action.theme };
    case "TOGGLE_EDITOR":
      return { ...state, editorOpen: !state.editorOpen };
    case "TOGGLE_PROPERTIES":
      return { ...state, propertiesOpen: !state.propertiesOpen };
    case "TOGGLE_MINIMAP":
      return { ...state, minimapOpen: !state.minimapOpen };
    case "TOGGLE_LLM":
      return { ...state, llmOpen: !state.llmOpen };
    case "SET_PANEL_POSITION":
      return {
        ...state,
        panelPositions: {
          ...state.panelPositions,
          [action.panelId]: action.position,
        },
      };
    case "SET_SELECTED_NODES":
      return { ...state, selectedNodeIds: action.ids };
    case "SET_DIAGNOSTICS":
      return { ...state, diagnostics: action.diagnostics };
    case "SET_RENDER_ERROR":
      return { ...state, renderError: action.error };
    case "SET_LLM_PROVIDER":
      return { ...state, llmProvider: action.provider };
    case "SET_LLM_MODEL":
      return { ...state, llmModel: action.model };
    case "SET_LLM_LOADING":
      return { ...state, llmLoading: action.loading };
    case "ADD_LLM_MESSAGE":
      return {
        ...state,
        llmChat: [
          ...state.llmChat,
          { role: action.role, content: action.content, ts: Date.now() },
        ],
      };
    case "CLEAR_LLM_CHAT":
      return { ...state, llmChat: [] };
    case "SET_GRAPH_STATS":
      return { ...state, nodeCount: action.nodeCount, edgeCount: action.edgeCount };
    case "SET_IS_RENDERING":
      return { ...state, isRendering: action.rendering };
    case "LOAD_STATE":
      return { ...state, ...action.state };
    default:
      return state;
  }
}

// ─────────────────────────────── Initial State ───────────────────────────────

function getInitialState(): GraphiqueState {
  return {
    code: `graph TD
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
    format: "mermaid",
    layout: "hierarchical",
    direction: "TB",
    theme: "dark",
    editorOpen: true,
    propertiesOpen: true,
    minimapOpen: true,
    llmOpen: false,
    panelPositions: {
      editor: "bottom",
      properties: "right",
      llm: "right",
    },
    selectedNodeIds: new Set(),
    diagnostics: [],
    renderError: null,
    llmProvider: "openai",
    llmModel: "gpt-4o",
    llmLoading: false,
    llmChat: [],
    nodeCount: 0,
    edgeCount: 0,
    isRendering: false,
  };
}

// ─────────────────────────────── Context ─────────────────────────────────────

interface GraphiqueContextValue {
  state: GraphiqueState;
  dispatch: React.Dispatch<Action>;
  setCode: (code: string) => void;
  setTheme: (theme: GraphiqueTheme) => void;
  setLayout: (layout: LayoutAlgorithm) => void;
}

const GraphiqueContext = createContext<GraphiqueContextValue | null>(null);

export function GraphiqueProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, getInitialState());

  // Load persisted state on mount
  useEffect(() => {
    const saved = loadAppState();
    // Migration: if stored LLM provider isn't browser-compatible, fallback to openai
    const browserProviderIds = LLM_PROVIDERS.filter((p) => p.browserCompatible).map((p) => p.id);
    const storedProvider = saved.llmProvider || "openai";
    const safeProvider = browserProviderIds.includes(storedProvider) ? storedProvider : "openai";
    if (safeProvider !== storedProvider) {
      try { localStorage.removeItem("graphique_key_" + storedProvider); } catch {}
    }
    dispatch({
      type: "LOAD_STATE",
      state: {
        code: saved.currentCode,
        format: saved.currentFormat,
        layout: saved.currentLayout,
        theme: saved.currentTheme,
        llmProvider: safeProvider,
        llmModel: safeProvider === "openai" ? "gpt-4o" : saved.llmModel,
        editorOpen: saved.editorPanelOpen,
        propertiesOpen: saved.propertiesPanelOpen,
        minimapOpen: saved.minimapOpen,
        llmOpen: saved.llmPanelOpen,
        panelPositions: saved.panelPositions,
      },
    });
  }, []);

  // Persist state changes
  useEffect(() => {
    saveAppState({
      currentCode: state.code,
      currentFormat: state.format,
      currentLayout: state.layout,
      currentTheme: state.theme,
      llmProvider: state.llmProvider,
      llmModel: state.llmModel,
      editorPanelOpen: state.editorOpen,
      propertiesPanelOpen: state.propertiesOpen,
      minimapOpen: state.minimapOpen,
      llmPanelOpen: state.llmOpen,
      panelPositions: state.panelPositions,
    });
  }, [
    state.code,
    state.format,
    state.layout,
    state.theme,
    state.llmProvider,
    state.llmModel,
    state.editorOpen,
    state.propertiesOpen,
    state.minimapOpen,
    state.llmOpen,
    state.panelPositions,
  ]);

  const setCode = useCallback((code: string) => dispatch({ type: "SET_CODE", code }), []);
  const setTheme = useCallback(
    (theme: GraphiqueTheme) => dispatch({ type: "SET_THEME", theme }),
    []
  );
  const setLayout = useCallback(
    (layout: LayoutAlgorithm) => dispatch({ type: "SET_LAYOUT", layout }),
    []
  );

  return (
    <GraphiqueContext.Provider value={{ state, dispatch, setCode, setTheme, setLayout }}>
      {children}
    </GraphiqueContext.Provider>
  );
}

export function useGraphique(): GraphiqueContextValue {
  const ctx = useContext(GraphiqueContext);
  if (!ctx) throw new Error("useGraphique must be used within GraphiqueProvider");
  return ctx;
}