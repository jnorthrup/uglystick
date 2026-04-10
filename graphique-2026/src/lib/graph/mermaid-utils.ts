// ─────────────────────────────────────────────────────────────────────────────
// GRAPHIQUE 2026 — Mermaid Utilities
// ─────────────────────────────────────────────────────────────────────────────

import type { LayoutAlgorithm, GraphiqueTheme } from "./types";

/**
 * Maps GRAPHIQUE layout algorithms to Mermaid graph direction
 */
export function layoutToMermaidDirection(
  algorithm: LayoutAlgorithm
): string {
  switch (algorithm) {
    case "hierarchical":
    case "elk-layered":
    case "tree":
    case "elk-mrtree":
    case "bus":
      return "TD";
    case "force":
    case "elk-force":
    case "orthogonal":
      return "LR";
    case "circular":
    case "elk-radial":
      return "TB";
    default:
      return "TD";
  }
}

/**
 * Returns the ELK layout string for use in Mermaid code (%%{init}%%)
 */
export function algorithmToElkLayout(algorithm: LayoutAlgorithm): string | null {
  switch (algorithm) {
    case "elk-layered":
      return "elk";
    case "elk-mrtree":
      return "elk";
    case "elk-radial":
      return "elk";
    case "elk-force":
      return "elk";
    default:
      return null;
  }
}

/**
 * Transforms a Mermaid flowchart code to use a different direction
 */
export function setMermaidDirection(code: string, direction: string): string {
  // Replace existing direction
  return code.replace(
    /^(\s*graph\s+)(TB|TD|BT|LR|RL|BT)/im,
    `$1${direction}`
  );
}

/**
 * Injects ELK layout init config into Mermaid code
 */
export function injectElkLayout(
  code: string,
  elkAlgorithm: string,
  direction: string
): string {
  const trimmed = code.trim();
  // Remove existing %%{init}%% block if present
  const withoutInit = trimmed.replace(/^%%\{[\s\S]*?\}%%\s*/m, "");

  const initBlock = `%%{init: {"theme": "base", "flowchart": {"curve": "basis", "defaultRenderer": "elk"}} }%%\n`;
  // Replace graph direction
  const withDir = withoutInit.replace(
    /^(\s*graph\s+)(TB|TD|BT|LR|RL|BT)/im,
    `$1${direction}`
  );
  return initBlock + withDir;
}

/**
 * Maps GRAPHIQUE theme to Mermaid theme
 */
export function themeToMermaid(theme: GraphiqueTheme): string {
  switch (theme) {
    case "dark":
    case "observatory":
    case "dracula":
    case "nord":
      return "dark";
    case "forest":
      return "forest";
    case "neutral":
      return "neutral";
    case "light":
    default:
      return "default";
  }
}

/**
 * Detects diagram type from code
 */
export type DiagramType =
  | "flowchart"
  | "sequence"
  | "class"
  | "state"
  | "er"
  | "gantt"
  | "pie"
  | "mindmap"
  | "gitgraph"
  | "xychart"
  | "block"
  | "unknown"
  | "dot";

export function detectDiagramType(code: string): DiagramType {
  const trimmed = code.trim().toLowerCase();
  if (trimmed.startsWith("graph ") || trimmed.startsWith("flowchart ")) return "flowchart";
  if (trimmed.startsWith("sequencediagram")) return "sequence";
  if (trimmed.startsWith("classdiagram")) return "class";
  if (trimmed.startsWith("statediagram")) return "state";
  if (trimmed.startsWith("erdiagram")) return "er";
  if (trimmed.startsWith("gantt")) return "gantt";
  if (trimmed.startsWith("pie")) return "pie";
  if (trimmed.startsWith("mindmap")) return "mindmap";
  if (trimmed.startsWith("gitgraph")) return "gitgraph";
  if (trimmed.startsWith("xychart")) return "xychart";
  if (trimmed.startsWith("block-beta")) return "block";
  if (trimmed.startsWith("digraph") || trimmed.startsWith("graph{") || trimmed.startsWith("graph {")) return "dot";
  return "unknown";
}

/**
 * Extracts all node IDs from a simple flowchart code (rough parser for stats)
 */
export function extractFlowchartStats(code: string): {
  nodeCount: number;
  edgeCount: number;
} {
  const lines = code.split("\n").filter((l) => !l.trim().startsWith("%%"));
  let nodeCount = 0;
  let edgeCount = 0;

  const nodePattern =
    /^\s*([A-Za-z0-9_]+)[\[\(\{<>]/;
  const edgePattern =
    /-->|---|-\.->|==>/;

  const seen = new Set<string>();
  for (const line of lines) {
    if (edgePattern.test(line)) {
      edgeCount++;
      // Count nodes in this line
      const nodeMatches = line.match(/[A-Za-z0-9_]+(?=[\[\(\{<>])/g);
      if (nodeMatches) {
        for (const n of nodeMatches) {
          if (!seen.has(n)) {
            seen.add(n);
            nodeCount++;
          }
        }
      }
    } else if (nodePattern.test(line)) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)[\[\(\{<>]/);
      if (m && !seen.has(m[1])) {
        seen.add(m[1]);
        nodeCount++;
      }
    }
  }

  return { nodeCount, edgeCount };
}

export const SAMPLE_DIAGRAMS: Record<string, string> = {
  flowchart: `graph TD
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

  sequence: `sequenceDiagram
    participant C as Client
    participant G as API Gateway
    participant A as Auth Service
    participant D as Database

    C->>G: POST /api/query
    G->>A: Validate Token
    A-->>G: Token Valid ✓
    G->>D: Execute Query
    D-->>G: Result Set
    G-->>C: JSON Response
    
    Note over C,D: All communication over TLS 1.3`,

  class: `classDiagram
    class IGraph {
      +Map nodes
      +Map edges
      +Map groups
      +toMermaid() string
      +toDOT() string
      +toJSON() object
    }
    class INode {
      +string id
      +string label
      +NodeShape shape
      +number x
      +number y
      +NodeStyle style
    }
    class IEdge {
      +string id
      +string source
      +string target
      +string label
      +EdgeType type
    }
    IGraph "1" --> "n" INode : contains
    IGraph "1" --> "n" IEdge : contains
    INode "1" --> "n" IEdge : source/target`,

  er: `erDiagram
    USER ||--o{ PROJECT : owns
    USER ||--o{ GRAPH : creates
    PROJECT ||--|{ GRAPH : contains
    GRAPH ||--|{ NODE : has
    GRAPH ||--|{ EDGE : has
    NODE ||--o{ EDGE : "source of"
    NODE ||--o{ EDGE : "target of"
    
    USER {
        uuid id PK
        string name
        string email
        timestamp created_at
    }
    GRAPH {
        uuid id PK
        string title
        string format
        text content
        uuid owner_id FK
    }`,

  mindmap: `mindmap
  root((GRAPHIQUE))
    Layout Engines
      Hierarchical
      Force-Directed
      ELK Integration
      Circular
    Formats
      Mermaid
      Graphviz DOT
      JSON
    Features
      Monaco Editor
      Pan & Zoom
      Export PNG/SVG
      AI Assistant
    Themes
      Dark
      Light
      Forest
      Custom`,

  gitgraph: `gitGraph
   commit id: "Initial commit"
   commit id: "Add graph model"
   branch feature/layout
   checkout feature/layout
   commit id: "ELK integration"
   commit id: "Force layout"
   checkout main
   branch feature/llm
   checkout feature/llm
   commit id: "LLM gateway"
   commit id: "AI diagnostics"
   checkout main
   merge feature/layout id: "Merge layouts"
   merge feature/llm id: "Merge AI"
   commit id: "v2026.1.0 release"`,

  dot: `digraph Architecture {
  rankdir=LR;
  node [shape=rectangle, style=filled, fontname="monospace"];
  
  subgraph cluster_ui {
    label="Presentation Layer";
    style=filled;
    color="#1a2744";
    fontcolor="#00D2FF";
    Editor [fillcolor="#1e3a5f", fontcolor="#cdd6f4"]
    Renderer [fillcolor="#1e3a5f", fontcolor="#cdd6f4"]
    LLMPanel [fillcolor="#1e3a5f", fontcolor="#cdd6f4"]
  }
  
  subgraph cluster_core {
    label="Core Engine";
    style=filled;
    color="#2a1744";
    fontcolor="#FFB347";
    Parser [fillcolor="#3d1f5f", fontcolor="#cdd6f4"]
    LayoutEngine [fillcolor="#3d1f5f", fontcolor="#cdd6f4"]
    GraphModel [fillcolor="#3d1f5f", fontcolor="#cdd6f4"]
  }
  
  Editor -> Parser -> GraphModel
  GraphModel -> LayoutEngine -> Renderer
  LLMPanel -> GraphModel
}`,
};