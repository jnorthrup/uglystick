// ─────────────────────────────────────────────────────────────────────────────
// GRAPHIQUE 2026 — ELK Layout Engine (standalone, post-render)
// Uses elkjs to compute positions, applies them to Mermaid SVG via transforms.
// Bypasses Mermaid's broken ELK renderer which drops text labels.
// ─────────────────────────────────────────────────────────────────────────────

import ELK from "elkjs/lib/elk.bundled.js";

interface ELKNode {
  id: string;
  labels?: Array<{ text: string; width?: number; height?: number }>;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
}

interface ELKEdge {
  id: string;
  sources: string[];
  targets: string[];
  labels?: Array<{ text: string }>;
}

interface ELKGraph {
  id: string;
  children: ELKNode[];
  edges: ELKEdge[];
  layoutOptions?: Record<string, string>;
}

export interface LayoutResult {
  nodes: Map<string, { x: number; y: number; w: number; h: number }>;
  edges: Map<string, { points: { x: number; y: number }[] }>;
  graphWidth: number;
  graphHeight: number;
}

/**
 * Parse Mermaid flowchart into ELK graph structure.
 */
function parseMermaidToELK(code: string): { graph: ELKGraph; edgeLabels: Map<string, string> } {
  const lines = code
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("%%") && !l.startsWith("style ") && !l.startsWith("classDef ") && !l.startsWith("linkStyle "));

  const nodeIds = new Set<string>();
  const nodeLabels = new Map<string, string>();
  const edges: ELKEdge[] = [];
  const edgeLabels = new Map<string, string>();
  let edgeId = 0;

  for (const line of lines) {
    if (line.startsWith("graph ") || line.startsWith("flowchart ") || line.startsWith("subgraph")) continue;

    // Parse edges: A --> B, A -->|label| B, A --- B, A -.-> B, A ==> B
    const edgeMatch = line.match(
      /^([A-Za-z0-9_]+)\s*(?:--[\s.=>]*)(?:\|([^|]*)\|)?\s*[-.=>]*\s*([A-Za-z0-9_]+)/
    );
    if (edgeMatch) {
      const [, src, label, tgt] = edgeMatch;
      nodeIds.add(src);
      nodeIds.add(tgt);
      if (!nodeLabels.has(src)) nodeLabels.set(src, src);
      if (!nodeLabels.has(tgt)) nodeLabels.set(tgt, tgt);
      const eid = `e${edgeId++}`;
      edges.push({ id: eid, sources: [src], targets: [tgt] });
      if (label && label.trim()) {
        edgeLabels.set(eid, label.trim());
        edges[edges.length - 1].labels = [{ text: label.trim() }];
      }
      continue;
    }

    // Parse node definitions: A[Label], B{Label}, C((Label)), D[Label]
    const nodeMatch = line.match(/^([A-Za-z0-9_]+)[\[\(\{\<]/);
    if (nodeMatch) {
      const id = nodeMatch[1];
      nodeIds.add(id);
      // Extract label from brackets
      const labelMatch = line.match(
        /\[([^\]]*)\]|\{([^}]*)\}|\<([^\>]*)\>|\(\(([^\)]*)\)\)|\[\(([^\)]*)\)\)/
      );
      const label = labelMatch
        ? (labelMatch[1] || labelMatch[2] || labelMatch[3] || labelMatch[4] || labelMatch[5] || id)
        : id;
      nodeLabels.set(id, label);
    }
  }

  const elkNodes: ELKNode[] = Array.from(nodeIds).map((id) => ({
    id,
    labels: [{ text: nodeLabels.get(id) || id }],
    width: 150,
    height: 60,
  }));

  return { graph: { id: "root", children: elkNodes, edges }, edgeLabels };
}

/**
 * Compute ELK layout for a given algorithm.
 */
async function computeELKLayout(
  code: string,
  algorithm: string,
  direction: string
): Promise<LayoutResult> {
  const { graph, edgeLabels } = parseMermaidToELK(code);

  if (graph.children.length === 0) {
    return { nodes: new Map(), edges: new Map(), graphWidth: 0, graphHeight: 0 };
  }

  const dirMap: Record<string, string> = { TD: "DOWN", BT: "UP", LR: "RIGHT", RL: "LEFT" };
  const elkDir = dirMap[direction] || "DOWN";

  const baseOptions: Record<string, string> = {
    "elk.direction": elkDir,
    "elk.spacing.nodeNode": "40",
    "elk.spacing.edgeNode": "20",
    "elk.spacing.edgeEdge": "15",
    "elk.padding": "[top=20,left=20,bottom=20,right=20]",
    "elk.edgeRouting": "POLYLINE",
  };

  const algorithmOptions: Record<string, Record<string, string>> = {
    "elk-layered": {
      "elk.algorithm": "layered",
      "elk.layered.spacing.nodeNodeBetweenLayers": "80",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
    },
    "elk-mrtree": {
      "elk.algorithm": "mrtree",
    },
    "elk-radial": {
      "elk.algorithm": "radial",
      "elk.spacing.nodeNode": "60",
    },
    "elk-force": {
      "elk.algorithm": "force",
      "elk.force.iterations": "300",
    },
    bus: {
      "elk.algorithm": "layered",
      "elk.layered.spacing.nodeNodeBetweenLayers": "100",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
    },
    hierarchical: {
      "elk.algorithm": "layered",
      "elk.layered.spacing.nodeNodeBetweenLayers": "80",
    },
    force: {
      "elk.algorithm": "force",
      "elk.force.iterations": "500",
      "elk.spacing.nodeNode": "80",
    },
    tree: {
      "elk.algorithm": "mrtree",
      "elk.spacing.nodeNode": "30",
    },
    circular: {
      "elk.algorithm": "radial",
      "elk.spacing.nodeNode": "60",
    },
    orthogonal: {
      "elk.algorithm": "layered",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.layered.spacing.nodeNodeBetweenLayers": "60",
    },
  };

  graph.layoutOptions = {
    ...baseOptions,
    ...(algorithmOptions[algorithm] || {}),
  };

  const elk = new ELK();

  try {
    const laidOut = await elk.layout(graph);
    const nodes = new Map<string, { x: number; y: number; w: number; h: number }>();
    const edges = new Map<string, { points: { x: number; y: number }[] }>();
    let maxX = 0;
    let maxY = 0;

    if (laidOut.children) {
      for (const node of laidOut.children) {
        if (node.x !== undefined && node.y !== undefined) {
          nodes.set(node.id, {
            x: node.x,
            y: node.y,
            w: node.width || 150,
            h: node.height || 60,
          });
          maxX = Math.max(maxX, node.x + (node.width || 150));
          maxY = Math.max(maxY, node.y + (node.height || 60));
        }
      }
    }

    if (laidOut.edges) {
      for (const edge of laidOut.edges) {
        if (edge.sections && edge.sections.length > 0) {
          const points = edge.sections.flatMap((s) => [
            { x: s.startPoint.x, y: s.startPoint.y },
            ...(s.bendPoints || []),
            { x: s.endPoint.x, y: s.endPoint.y },
          ]);
          edges.set(edge.id, { points });
        }
      }
    }

    return { nodes, edges, graphWidth: maxX, graphHeight: maxY };
  } catch (err) {
    console.warn("[ELK] Layout failed:", err);
    return { nodes: new Map(), edges: new Map(), graphWidth: 0, graphHeight: 0 };
  }
}

/**
 * Apply ELK-computed positions to Mermaid SVG.
 * Translates .node groups to match ELK positions.
 */
export function applyELKLayoutToSVG(
  svgEl: SVGSVGElement | null,
  layout: LayoutResult
): void {
  if (!svgEl || layout.nodes.size === 0) return;

  const nodeGroups = svgEl.querySelectorAll(".node");
  if (!nodeGroups.length) return;

  // Build a label-to-node-id map for matching
  const labelToId = new Map<string, string>();
  for (const [id, pos] of layout.nodes) {
    labelToId.set(id.toLowerCase(), id);
  }

  nodeGroups.forEach((group) => {
    // Find the text/tspan element to get the label
    const textEl = group.querySelector("text") || group.querySelector("tspan");
    if (!textEl) return;

    const textContent = textEl.textContent?.trim();
    if (!textContent) return;

    // Try to match by label
    for (const [label, id] of labelToId) {
      if (textContent.toLowerCase().includes(label) || label.includes(textContent.toLowerCase().substring(0, 10))) {
        const pos = layout.nodes.get(id);
        if (pos) {
          group.setAttribute("transform", `translate(${pos.x + 10}, ${pos.y + 10})`);
          break;
        }
      }
    }
  });
}

/**
 * Compute and apply ELK layout directly to Mermaid SVG.
 * This is the main entry point called from GraphCanvas.
 */
export async function computeAndApplyLayout(
  svgEl: SVGSVGElement | null,
  code: string,
  algorithm: string,
  direction: string
): Promise<boolean> {
  if (!svgEl) return false;

  const layout = await computeELKLayout(code, algorithm, direction);
  if (layout.nodes.size === 0) return false;

  applyELKLayoutToSVG(svgEl, layout);
  return true;
}
