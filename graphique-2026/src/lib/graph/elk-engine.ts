// ─────────────────────────────────────────────────────────────────────────────
// GRAPHIQUE 2026 — D3 Force Layout Engine
// Pure d3-force simulation with direct SVG rendering.
// No ELK, no Mermaid layout — we compute positions and draw SVG ourselves.
// ─────────────────────────────────────────────────────────────────────────────

import * as d3 from "d3";

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  layer?: number;
  angle?: number;
  radius?: number;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  id: string;
  source: string;
  target: string;
  label?: string;
}

interface GraphData {
  nodes: { id: string; label: string }[];
  edges: { id: string; source: string; target: string; label?: string }[];
}

function parseGraph(code: string): GraphData {
  const lines = code
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("%%") && !l.startsWith("style ") && !l.startsWith("classDef ") && !l.startsWith("linkStyle "));

  const nodes = new Map<string, string>();
  const edges: { id: string; source: string; target: string; label?: string }[] = [];
  let edgeId = 0;

  for (const line of lines) {
    if (line.startsWith("graph ") || line.startsWith("flowchart ") || line.startsWith("subgraph")) continue;

    const edgeMatch = line.match(
      /^([A-Za-z0-9_]+)\s*(?:--[\s.=>]*)(?:\|([^|]*)\|)?\s*[-.=>]*\s*([A-Za-z0-9_]+)/
    );
    if (edgeMatch) {
      const [, src, label, tgt] = edgeMatch;
      if (!nodes.has(src)) nodes.set(src, src);
      if (!nodes.has(tgt)) nodes.set(tgt, tgt);
      edges.push({ id: `e${edgeId++}`, source: src, target: tgt, label: label?.trim() });
      continue;
    }

    const nodeMatch = line.match(/^([A-Za-z0-9_]+)[\[\(\{\<]/);
    if (nodeMatch) {
      const id = nodeMatch[1];
      const labelMatch = line.match(
        /\[([^\]]*)\]|\{([^}]*)\}|\<([^\>]*)\>|\(\(([^\)]*)\)\)|\[\(([^\)]*)\)\)/
      );
      const label = labelMatch
        ? (labelMatch[1] || labelMatch[2] || labelMatch[3] || labelMatch[4] || labelMatch[5] || id)
        : id;
      nodes.set(id, label);
    }
  }

  return {
    nodes: Array.from(nodes.entries()).map(([id, label]) => ({ id, label })),
    edges,
  };
}

function configureSimulation(
  nodes: SimNode[],
  links: SimLink[],
  algorithm: string,
  direction: string
): d3.Simulation<SimNode, SimLink> {
  const width = 1200;
  const height = 800;

  // Assign initial positions based on layout type
  nodes.forEach((n, i) => {
    n.x = width / 2;
    n.y = height / 2;
  });

  const sim = d3
    .forceSimulation<SimNode>(nodes)
    .force("charge", d3.forceManyBody().strength(-400))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius(80))
    .stop();

  switch (algorithm) {
    case "hierarchical":
    case "elk-layered": {
      // Assign layers by topological sort
      const layers = computeLayers(nodes, links);
      sim
        .force("link", d3.forceLink<SimNode, SimLink>(links).id((d) => d.id).strength(0.8).distance(100))
        .force("y", d3.forceY((d) => (d.layer ?? 0) * 100 + 80).strength(0.9))
        .force("x", d3.forceX(width / 2).strength(0.1));
      break;
    }
    case "tree":
    case "elk-mrtree": {
      const layers = computeLayers(nodes, links);
      sim
        .force("link", d3.forceLink<SimNode, SimLink>(links).id((d) => d.id).strength(0.9).distance(80))
        .force("y", d3.forceY((d) => (d.layer ?? 0) * 100 + 80).strength(1.0))
        .force("x", d3.forceX(width / 2).strength(0.3))
        .force("charge", d3.forceManyBody().strength(-600));
      break;
    }
    case "force":
    case "elk-force": {
      sim
        .force("link", d3.forceLink<SimNode, SimLink>(links).id((d) => d.id).strength(0.5).distance(120))
        .force("charge", d3.forceManyBody().strength(-500));
      break;
    }
    case "circular":
    case "elk-radial": {
      const radius = Math.min(width, height) * 0.35;
      nodes.forEach((n, i) => {
        const angle = (i / nodes.length) * 2 * Math.PI;
        n.x = width / 2 + Math.cos(angle) * radius;
        n.y = height / 2 + Math.sin(angle) * radius;
      });
      sim
        .force("link", d3.forceLink<SimNode, SimLink>(links).id((d) => d.id).strength(0.3).distance(150))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2).strength(0.05));
      break;
    }
    case "orthogonal": {
      const layers = computeLayers(nodes, links);
      sim
        .force("link", d3.forceLink<SimNode, SimLink>(links).id((d) => d.id).strength(0.7).distance(100))
        .force("y", d3.forceY((d) => (d.layer ?? 0) * 100 + 80).strength(0.9))
        .force("x", d3.forceX(width / 2).strength(0.15))
        .force("charge", d3.forceManyBody().strength(-350));
      break;
    }
    case "bus": {
      // Bus: nodes arranged in a line with a central trunk
      sim
        .force("link", d3.forceLink<SimNode, SimLink>(links).id((d) => d.id).strength(0.3).distance(60))
        .force("x", d3.forceX((d, i) => {
          const side = i % 2 === 0 ? width * 0.3 : width * 0.7;
          return side;
        }).strength(0.8))
        .force("y", d3.forceY((d, i) => i * 100 + 80).strength(0.9))
        .force("charge", d3.forceManyBody().strength(-200));
      break;
    }
    default: {
      sim.force("link", d3.forceLink<SimNode, SimLink>(links).id((d) => d.id).strength(0.5).distance(100));
    }
  }

  return sim;
}

function computeLayers(nodes: SimNode[], links: SimLink[]): Map<string, number> {
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  const nodeIds = new Set(nodes.map((n) => n.id));

  nodes.forEach((n) => {
    adj.set(n.id, []);
    inDegree.set(n.id, 0);
  });

  for (const link of links) {
    if (nodeIds.has(link.source) && nodeIds.has(link.target)) {
      adj.get(link.source)?.push(link.target);
      inDegree.set(link.target, (inDegree.get(link.target) || 0) + 1);
    }
  }

  // BFS topological sort
  const queue: string[] = [];
  const layers = new Map<string, number>();

  nodes.forEach((n) => {
    if ((inDegree.get(n.id) || 0) === 0) {
      queue.push(n.id);
      layers.set(n.id, 0);
    }
  });

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLayer = layers.get(current) || 0;
    for (const neighbor of adj.get(current) || []) {
      const newLayer = currentLayer + 1;
      if (!layers.has(neighbor) || layers.get(neighbor)! < newLayer) {
        layers.set(neighbor, newLayer);
      }
      inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1);
      if ((inDegree.get(neighbor) || 0) === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Assign unvisited nodes to layer 0
  nodes.forEach((n) => {
    if (!layers.has(n.id)) layers.set(n.id, 0);
  });

  return layers;
}

export interface LayoutResult {
  nodes: { id: string; label: string; x: number; y: number; w: number; h: number }[];
  edges: { id: string; source: string; target: string; label?: string; sx: number; sy: number; tx: number; ty: number }[];
  width: number;
  height: number;
}

export async function computeLayout(
  code: string,
  algorithm: string,
  direction: string
): Promise<LayoutResult> {
  const { nodes: nodeList, edges: edgeList } = parseGraph(code);
  if (nodeList.length === 0) return { nodes: [], edges: [], width: 0, height: 0 };

  const simNodes: SimNode[] = nodeList.map((n) => ({ ...n }));
  const simLinks: SimLink[] = edgeList.map((e) => ({ ...e }));

  const sim = configureSimulation(simNodes, simLinks, algorithm, direction);

  // Run simulation synchronously
  sim.tick(300);

  const nodeW = 150;
  const nodeH = 60;

  const resultNodes = simNodes.map((n) => ({
    id: n.id,
    label: n.label,
    x: n.x ?? 0,
    y: n.y ?? 0,
    w: nodeW,
    h: nodeH,
  }));

  const resultEdges = edgeList.map((e, i) => {
    const src = simNodes.find((n) => n.id === e.source);
    const tgt = simNodes.find((n) => n.id === e.target);
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      sx: src?.x ?? 0,
      sy: src?.y ?? 0,
      tx: tgt?.x ?? 0,
      ty: tgt?.y ?? 0,
    };
  });

  let maxW = 0;
  let maxH = 0;
  for (const n of resultNodes) {
    maxW = Math.max(maxW, n.x + n.w);
    maxH = Math.max(maxH, n.y + n.h);
  }

  return { nodes: resultNodes, edges: resultEdges, width: maxW + 40, height: maxH + 40 };
}

function roundedRect(x: number, y: number, w: number, h: number): string {
  const r = 8;
  return `M${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} L${x + r},${y + h} Q${x},${y + h} ${x},${y + h - r} L${x},${y + r} Q${x},${y} ${x + r},${y} Z`;
}

export function renderSVG(graph: LayoutResult, theme: string = "dark"): string {
  const padding = 30;
  const w = graph.width + padding * 2;
  const h = graph.height + padding * 2;

  const isDark = theme === "dark" || theme === "observatory" || theme === "dracula" || theme === "nord";
  const nodeFill = isDark ? "#1e3a5f" : "#f0f4f8";
  const nodeStroke = isDark ? "#00D2FF" : "#3b82f6";
  const edgeColor = isDark ? "#00D2FF" : "#3b82f6";
  const textColor = isDark ? "#cdd6f4" : "#1e293b";
  const labelBg = isDark ? "#1a2744" : "#e2e8f0";

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="JetBrains Mono, monospace">`;

  svg += `<defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="${edgeColor}" />
    </marker>
  </defs>`;

  // Edges first (so they render behind nodes)
  for (const edge of graph.edges) {
    const sx = edge.sx + padding + 75;
    const sy = edge.sy + padding + 30;
    const tx = edge.tx + padding + 75;
    const ty = edge.ty + padding + 30;

    svg += `<line x1="${sx}" y1="${sy}" x2="${tx}" y2="${ty}" stroke="${edgeColor}" stroke-width="2" marker-end="url(#arrowhead)" />`;

    if (edge.label) {
      const mx = (sx + tx) / 2;
      const my = (sy + ty) / 2;
      svg += `<rect x="${mx - 20}" y="${my - 10}" width="40" height="16" fill="${labelBg}" rx="3" />`;
      svg += `<text x="${mx}" y="${my + 3}" fill="${textColor}" font-size="10" text-anchor="middle">${edge.label}</text>`;
    }
  }

  // Nodes
  for (const node of graph.nodes) {
    const nx = node.x + padding;
    const ny = node.y + padding;

    svg += `<path d="${roundedRect(nx, ny, node.w, node.h)}" fill="${nodeFill}" stroke="${nodeStroke}" stroke-width="2" />`;
    svg += `<text x="${nx + node.w / 2}" y="${ny + node.h / 2 + 4}" fill="${textColor}" font-size="12" text-anchor="middle" pointer-events="none">${node.label}</text>`;
  }

  svg += "</svg>";
  return svg;
}
