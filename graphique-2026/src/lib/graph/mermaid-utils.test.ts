import { describe, it, expect } from "vitest";
import {
  injectLayoutForAlgorithm,
  setMermaidDirection,
  layoutToMermaidDirection,
  themeToMermaid,
} from "./mermaid-utils";

describe("injectLayoutForAlgorithm", () => {
  const code = "graph TD\n  A --> B\n  B --> C";

  it("replaces TD direction with LR", () => {
    const result = injectLayoutForAlgorithm(code, "hierarchical", "LR");
    expect(result).toContain("graph LR");
    expect(result).not.toContain("graph TD");
  });

  it("replaces LR direction with BT", () => {
    const code2 = "graph LR\n  A --> B";
    const result = injectLayoutForAlgorithm(code2, "force", "BT");
    expect(result).toContain("graph BT");
    expect(result).not.toContain("graph LR");
  });

  it("replaces direction for flowchart keyword too", () => {
    const code2 = "flowchart TD\n  A --> B";
    const result = injectLayoutForAlgorithm(code2, "tree", "RL");
    expect(result).toContain("flowchart RL");
  });

  it("strips existing %%{init}%% blocks to avoid conflicts", () => {
    const codeWithInit = '%%{init: {"flowchart":{}}}%%\ngraph TD\n  A --> B';
    const result = injectLayoutForAlgorithm(codeWithInit, "hierarchical", "LR");
    expect(result).toContain("graph LR");
    expect(result).not.toContain("%%{init");
  });

  it("returns code unchanged for non-flowchart diagrams", () => {
    const sequenceCode = "sequenceDiagram\n  A->>B: Hello";
    const result = injectLayoutForAlgorithm(sequenceCode, "hierarchical", "LR");
    expect(result).toBe(sequenceCode);
  });
});

describe("setMermaidDirection", () => {
  it("replaces TD with LR", () => {
    expect(setMermaidDirection("graph TD\n  A --> B", "LR")).toBe("graph LR\n  A --> B");
  });

  it("replaces LR with BT", () => {
    expect(setMermaidDirection("graph LR\n  A --> B", "BT")).toBe("graph BT\n  A --> B");
  });
});

describe("layoutToMermaidDirection", () => {
  it("maps hierarchical to TD", () => {
    expect(layoutToMermaidDirection("hierarchical")).toBe("TD");
  });

  it("maps force to LR", () => {
    expect(layoutToMermaidDirection("force")).toBe("LR");
  });

  it("maps elk-layered to TD", () => {
    expect(layoutToMermaidDirection("elk-layered")).toBe("TD");
  });
});

describe("themeToMermaid", () => {
  it("maps dark to dark", () => {
    expect(themeToMermaid("dark")).toBe("dark");
  });

  it("maps light to default", () => {
    expect(themeToMermaid("light")).toBe("default");
  });

  it("maps forest to forest", () => {
    expect(themeToMermaid("forest")).toBe("forest");
  });
});
