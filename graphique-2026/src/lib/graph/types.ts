// ─────────────────────────────────────────────────────────────────────────────
// GRAPHIQUE 2026 — Core Graph Types (IGraph interface)
// ─────────────────────────────────────────────────────────────────────────────

export type NodeShape =
  | "rectangle"
  | "rounded"
  | "diamond"
  | "circle"
  | "ellipse"
  | "hexagon"
  | "parallelogram"
  | "cylinder"
  | "stadium"
  | "subroutine"
  | "database"
  | "asymmetric"
  | "trapezoid";

export type EdgeType =
  | "arrow"
  | "line"
  | "dotted"
  | "thick"
  | "dotted-arrow"
  | "invisible"
  | "double-arrow";

export type ArrowType = "arrow" | "open" | "dot" | "cross" | "none";

export interface Point {
  x: number;
  y: number;
}

export interface IPort {
  id: string;
  side: "top" | "bottom" | "left" | "right";
  offset?: number;
}

export interface NodeStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fontSize?: number;
  fontColor?: string;
  fontFamily?: string;
  opacity?: number;
  cssClass?: string;
}

export interface EdgeStyle {
  stroke?: string;
  strokeWidth?: number;
  strokeDash?: string;
  opacity?: number;
  cssClass?: string;
}

export interface GroupStyle {
  fill?: string;
  stroke?: string;
  opacity?: number;
}

export interface INode {
  id: string;
  label: string;
  shape: NodeShape;
  x: number;
  y: number;
  width: number;
  height: number;
  style: NodeStyle;
  groupId?: string;
  ports?: IPort[];
  metadata: Record<string, unknown>;
}

export interface IEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type: EdgeType;
  arrowStart?: ArrowType;
  arrowEnd?: ArrowType;
  waypoints?: Point[];
  style: EdgeStyle;
  metadata: Record<string, unknown>;
}

export interface IGroup {
  id: string;
  label: string;
  childIds: string[];
  style: GroupStyle;
}

export interface ILayoutData {
  algorithm: LayoutAlgorithm;
  direction: "TB" | "BT" | "LR" | "RL";
  spacing: { nodeSpacing: number; rankSpacing: number };
  computed: boolean;
}

export interface IStyleData {
  theme: GraphiqueTheme;
  classDefs: Map<string, NodeStyle>;
}

export type LayoutAlgorithm =
  | "hierarchical"
  | "force"
  | "tree"
  | "circular"
  | "orthogonal"
  | "concentric"
  | "elk-layered"
  | "elk-mrtree"
  | "elk-radial"
  | "elk-force"
  | "bus";

export type GraphiqueTheme =
  | "dark"
  | "light"
  | "forest"
  | "neutral"
  | "observatory"
  | "dracula"
  | "nord";

export type DiagramFormat = "mermaid" | "dot" | "json";

export interface DiagnosticSeverity {
  type: "error" | "warning" | "info" | "hint";
}

export interface IDiagnostic {
  severity: "error" | "warning" | "info" | "hint";
  code: string;
  message: string;
  startLine: number;
  endLine: number;
  startCol: number;
  endCol: number;
  quickFix?: string;
  documentation?: string;
}

export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  groupCount: number;
  maxDepth: number;
  isConnected: boolean;
  hasCycles: boolean;
}

export interface IGraph {
  id: string;
  title?: string;
  nodes: Map<string, INode>;
  edges: Map<string, IEdge>;
  groups: Map<string, IGroup>;
  layoutData: ILayoutData;
  styleData: IStyleData;
}

export interface LLMProvider {
  id: string;
  name: string;
  baseUrl: string;
  models: string[];
  requiresKey: boolean;
  /** Whether the provider supports direct browser-to-API calls (CORS-enabled) */
  browserCompatible: boolean;
}

export const LLM_PROVIDERS: LLMProvider[] = [
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
    requiresKey: true,
    browserCompatible: true,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    models: [
      "anthropic/claude-3.5-sonnet",
      "openai/gpt-4o",
      "google/gemini-2.0-flash",
      "meta-llama/llama-3.3-70b-instruct",
      "deepseek/deepseek-r1",
    ],
    requiresKey: true,
    browserCompatible: true,
  },
  {
    id: "nvidia-nim",
    name: "NVIDIA NIM",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    models: [
      "nvidia/llama-3.1-nemotron-70b-instruct",
      "meta/llama-3.3-70b-instruct",
    ],
    requiresKey: true,
    browserCompatible: false, // No CORS support — requires server proxy
  },
  {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    models: [
      "llama-3.3-70b-versatile",
      "mixtral-8x7b-32768",
      "gemma2-9b-it",
    ],
    requiresKey: true,
    browserCompatible: false, // No CORS support — requires server proxy
  },
  {
    id: "mistral",
    name: "Mistral AI",
    baseUrl: "https://api.mistral.ai/v1",
    models: ["mistral-large-latest", "mistral-medium-latest", "open-mixtral-8x7b"],
    requiresKey: true,
    browserCompatible: false, // No CORS support — requires server proxy
  },
];

export const LAYOUT_LABELS: Record<LayoutAlgorithm, string> = {
  hierarchical: "Hierarchical",
  force: "Force-Directed",
  tree: "Tree",
  circular: "Circular",
  orthogonal: "Orthogonal",
  concentric: "Concentric",
  "elk-layered": "ELK Layered",
  "elk-mrtree": "ELK Tree",
  "elk-radial": "ELK Radial",
  "elk-force": "ELK Force",
  bus: "Bus Routing",
};
