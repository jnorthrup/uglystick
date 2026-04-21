import { describe, it, expect } from "vitest";
import { parseMermaid } from "./mermaid-parser";
import { renderMermaidToSVG } from "./svg-renderer";

describe("parseMermaid", () => {
  it("parses the default sample diagram", () => {
    const code = `graph TD
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

    style A fill:#00D2FF,stroke:#0099BB,color:#000`;

    const r = parseMermaid(code);

    // 9 nodes with correct shapes
    expect(r.nodes.size).toBe(9);
    expect(r.nodes.get("A")).toEqual({ label: "Start", shape: "stadium" });
    expect(r.nodes.get("B")).toEqual({ label: "Decision", shape: "diamond" });
    expect(r.nodes.get("C")).toEqual({ label: "Process Alpha", shape: "rectangle" });
    expect(r.nodes.get("D")).toEqual({ label: "Process Beta", shape: "rectangle" });
    expect(r.nodes.get("E")).toEqual({ label: "Database", shape: "cylinder" });
    expect(r.nodes.get("F")).toEqual({ label: "Valid?", shape: "diamond" });
    expect(r.nodes.get("G")).toEqual({ label: "Output", shape: "parallelogram" });
    expect(r.nodes.get("H")).toEqual({ label: "Error Handler", shape: "rectangle" });
    expect(r.nodes.get("I")).toEqual({ label: "End", shape: "stadium" });

    // 10 edges with correct labels and clean IDs
    expect(r.edges.length).toBe(10);
    expect(r.edges[0].source).toBe("A");
    expect(r.edges[0].target).toBe("B");
    expect(r.edges[1].source).toBe("B");
    expect(r.edges[1].target).toBe("C");
    expect(r.edges[1].label).toBe("Yes");
    expect(r.edges[2].label).toBe("No");
    expect(r.edges[6].label).toBe("Valid");
    expect(r.edges[7].label).toBe("Invalid");

    // Direction
    expect(r.direction).toBe("TD");

    // Style parsed
    expect(r.nodeStyles.get("A")).toEqual({ fill: "#00D2FF", stroke: "#0099BB", fontColor: "#000" });
  });

  it("detects all shape types", () => {
    const code = `graph TD
    A[rect]
    B(rounded)
    C{diamond}
    D((circle))
    E([stadium])
    F[(cyl)]
    G[/para/]
    H[[sub]]
    I{{hex}}`;

    const r = parseMermaid(code);
    expect(r.nodes.get("A")?.shape).toBe("rectangle");
    expect(r.nodes.get("B")?.shape).toBe("rounded");
    expect(r.nodes.get("C")?.shape).toBe("diamond");
    expect(r.nodes.get("D")?.shape).toBe("circle");
    expect(r.nodes.get("E")?.shape).toBe("stadium");      // ([stadium]) = stadium
    expect(r.nodes.get("F")?.shape).toBe("cylinder");     // [(cyl)] = cylinder
    expect(r.nodes.get("G")?.shape).toBe("parallelogram");
    expect(r.nodes.get("H")?.shape).toBe("subroutine");
    expect(r.nodes.get("I")?.shape).toBe("hexagon");
  });

  it("adds nodes to enclosing subgraphs", () => {
    const code = `graph TD
    subgraph outer
      subgraph inner
        A[Node]
      end
    end`;

    const r = parseMermaid(code);
    expect(r.groups).toHaveLength(2);
    expect(r.groups[0].childIds).toContain("A");
    expect(r.groups[1].childIds).toContain("A");
  });
});

describe("renderMermaidToSVG", () => {
  it("produces Mermaid SVG with correct node/edge counts", async () => {
    const code = `graph TD
    A[Start] --> B[End]`;

    const r = await renderMermaidToSVG(code, "hierarchical", "TB", "dark");
    expect(r.nodeCount).toBe(2);
    expect(r.edgeCount).toBe(1);
    expect(r.svg).toContain("<svg");
    expect(r.svg).toContain("Start");
    expect(r.svg).toContain("End");
    expect(r.errors).toEqual([]);
  });

  it("renders grouped flowcharts through Mermaid", async () => {
    const code = `graph TD
    A([Start]) --> B{Decision}
    B --> C[Process]
    subgraph Group_One["Group One"]
      C --> D[Output]
    end`;

    const r = await renderMermaidToSVG(code, "concentric", "TB", "dark");
    expect(r.nodeCount).toBe(4);
    expect(r.edgeCount).toBe(3);
    expect(r.svg).toContain("Group One");
    expect(r.svg).toContain("Start");
    expect(r.svg).toContain("Decision");
    expect(r.svg).toContain("Process");
    expect(r.svg).toContain("Output");
  });

  it("handles empty flowcharts", async () => {
    const r = await renderMermaidToSVG("graph TD", "hierarchical", "TB", "dark");
    expect(r.nodeCount).toBe(0);
    expect(r.edgeCount).toBe(0);
    expect(r.svg).toBe("");
    expect(r.errors).toEqual([]);
  });

  it("renders non-flowchart Mermaid diagrams directly", async () => {
    const code = `sequenceDiagram
    participant C as Client
    participant G as API Gateway
    participant A as Auth Service

    C->>G: POST /api/query
    G->>A: Validate Token
    A-->>G: Token Valid`;

    const r = await renderMermaidToSVG(code, "hierarchical", "TB", "dark");
    expect(r.svg).toContain("<svg");
    expect(r.svg).toContain("Client");
    expect(r.svg).toContain("API Gateway");
    expect(r.svg).toContain("Auth Service");
    expect(r.errors).toEqual([]);
  });
});
