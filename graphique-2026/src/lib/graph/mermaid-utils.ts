// ─────────────────────────────────────────────────────────────────────────────
// GRAPHIQUE 2026 — Mermaid Utilities
// ─────────────────────────────────────────────────────────────────────────────

import type { LayoutAlgorithm, GraphiqueTheme } from "./types";
import type { MermaidConfig } from "mermaid";

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
    case "concentric":
      return "TB";
    default:
      return "TD";
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
 * Applies layout algorithm to Mermaid code.
 * Strategy: ONLY change direction. No %%{init}%% blocks.
 * Mermaid's native flowchart renderer handles text correctly.
 * Layout differences (spacing) are set via mermaid.initialize().
 */
export function injectLayoutForAlgorithm(
  code: string,
  algorithm: LayoutAlgorithm,
  direction: string
): string {
  const trimmed = code.trim();
  // Strip any existing init blocks FIRST to avoid conflicts
  const withoutInit = trimmed.replace(/^%%\{[\s\S]*?\}%%\s*/g, "");
  // Only apply to flowcharts
  if (
    !withoutInit.startsWith("graph ") &&
    !withoutInit.startsWith("flowchart ") &&
    !withoutInit.startsWith("flowchart-elk ")
  ) {
    return code;
  }
  // Replace direction
  return withoutInit.replace(
    /^(\s*(?:graph|flowchart(?:-elk)?)\s+)(TB|TD|BT|LR|RL)/im,
    `$1${direction}`
  );
}

/**
 * Maps GRAPHIQUE theme to Mermaid theme
 */
export function themeToMermaid(theme: GraphiqueTheme): NonNullable<MermaidConfig["theme"]> {
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
  if (
    trimmed.startsWith("graph ") ||
    trimmed.startsWith("flowchart ") ||
    trimmed.startsWith("flowchart-elk ")
  ) return "flowchart";
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

  network: `flowchart LR
    Internet((Internet)) --- Router[Edge Router]
    Router --- CoreSwitch{Core Switch}

    subgraph DC1 [Data Center 1]
      CoreSwitch --- S1[Rack Switch 1]
      S1 --- SRV1[Web Server 01]
      S1 --- SRV2[Web Server 02]
      S1 --- DB1[(Database 01)]
    end

    subgraph DC2 [Data Center 2]
      CoreSwitch --- S2[Rack Switch 2]
      S2 --- SRV3[Web Server 03]
      S2 --- SRV4[Web Server 04]
      S2 --- DB2[(Database 02)]
    end

    DB1 <-.->|Replication| DB2

    style Internet fill:#f9f,stroke:#333,stroke-width:4px
    style CoreSwitch fill:#00d2ff,stroke:#0099bb,color:#000`,

  org: `flowchart TD
    CEO([Chief Executive Officer])
    CEO --- CTO([Chief Technology Officer])
    CEO --- CFO([Chief Financial Officer])
    CEO --- COO([Chief Operating Officer])

    subgraph Tech [Technology Dept]
      CTO --- VPE([VP Engineering])
      CTO --- VPD([VP Design])
      VPE --- ARCH[System Architects]
      VPE --- DEV[Software Developers]
      VPD --- UIX[UX/UI Designers]
    end

    subgraph Ops [Operations Dept]
      COO --- HR[Human Resources]
      COO --- FAC[Facilities]
    end`,

  complex: `flowchart TD
    Start((Start)) --> Auth{Authenticated?}
    Auth -- No --> Login[Login Page]
    Login --> Auth
    Auth -- Yes --> Dashboard[/User Dashboard/]

    Dashboard --> Action1{Action A}
    Dashboard --> Action2{Action B}

    subgraph ServiceA [Microservice Alpha]
      Action1 --> ProcA1[[Process A1]]
      ProcA1 --> Cache[(Redis Cache)]
      Cache --> ProcA2[[Process A2]]
    end

    subgraph ServiceB [Microservice Beta]
      Action2 --> ProcB1[/Collect Data/]
      ProcB1 --> Store[(S3 Bucket)]
      Store --> ProcB2{Validate}
    end

    ProcA2 --> End((Finish))
    ProcB2 -- OK --> End
    ProcB2 -- Error --> ErrorHandle[Error Log]
    ErrorHandle --> Dashboard`,

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
