// ─────────────────────────────────────────────────────────────────────────────
// GRAPHIQUE 2026 — Layout Engine
// Pure layer-based layout with topological sort + force cleanup.
// No d3-dag dependency — works with any graph including cyclic ones.
// ─────────────────────────────────────────────────────────────────────────────

import * as d3 from "d3";

const NODE_W = 150;
const NODE_H = 50;
const NODE_GAP = 40;
const LAYER_GAP = 100;
const PADDING = 50;

interface ParsedGraph {
  nodes: Map<string, string>;
  edges: { source: string; target: string; label?: string }[];
}

function parseGraph(code: string): ParsedGraph {
  const lines = code
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("%%") && !l.startsWith("style ") && !l.startsWith("classDef ") && !l.startsWith("linkStyle "));

  const nodes = new Map<string, string>();
  const edges: { source: string; target: string; label?: string }[] = [];

  for (const line of lines) {
    if (line.startsWith("graph ") || line.startsWith("flowchart ") || line.startsWith("subgraph")) continue;

    const stripped = line.replace(/[\[\(\{\<][^\]\)\}\>]*[\]\)\}\>]/g, " _ ");
    const edgeMatch = stripped.match(
      /^\s*([A-Za-z0-9_]+)\s*(?:--[\s.=>]*)(?:\|([^|]*)\|)?\s*[-.=>]*\s*([A-Za-z0-9_]+)/
    );
    if (edgeMatch) {
      const [, src, label, tgt] = edgeMatch;
      if (!nodes.has(src)) nodes.set(src, src);
      if (!nodes.has(tgt)) nodes.set(tgt, tgt);
      edges.push({ source: src, target: tgt, label: label?.trim() });
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

  return { nodes, edges };
}

/**
 * Topological sort with cycle detection.
 * Returns nodes grouped by layer, and edges with back-edges flagged.
 */
function topologicalLayers(
  nodes: Map<string, string>,
  edges: { source: string; target: string; label?: string }[]
): { layers: string[][]; edgeSet: Set<string> } {
  const nodeIds = Array.from(nodes.keys());
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  nodeIds.forEach((id) => { inDegree.set(id, 0); adj.set(id, []); });

  const edgeSet = new Set<string>();
  for (const e of edges) {
    if (nodes.has(e.source) && nodes.has(e.target)) {
      adj.get(e.source)!.push(e.target);
      inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
      edgeSet.add(`${e.source}→${e.target}`);
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  nodeIds.forEach((id) => { if ((inDegree.get(id) || 0) === 0) queue.push(id); });

  const layers: string[][] = [];
  const assigned = new Set<string>();

  while (queue.length > 0) {
    const currentLayer = [...queue];
    layers.push(currentLayer);
    queue.length = 0;

    for (const node of currentLayer) {
      assigned.add(node);
      for (const neighbor of adj.get(node) || []) {
        inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
        if (inDegree.get(neighbor) === 0 && !assigned.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }
  }

  // Unassigned nodes are in cycles — put them in their own layers
  for (const id of nodeIds) {
    if (!assigned.has(id)) {
      layers.push([id]);
    }
  }

  return { layers, edgeSet };
}

export interface LayoutNode {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface LayoutEdge {
  points: { x: number; y: number }[];
  label?: string;
}

export interface LayoutResult {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
}

/**
 * Compute layout positions using layer-based placement.
 * This always works — no DAG requirement, no external layout library.
 */
export function computeLayout(
  code: string,
  algorithm: string,
  direction: string
): LayoutResult {
  const { nodes, edges } = parseGraph(code);
  if (nodes.size === 0) return { nodes: [], edges: [], width: 400, height: 300 };

  const { layers } = topologicalLayers(nodes, edges);
  const isVertical = direction === "TB" || direction === "BT";
  const isReversed = direction === "BT" || direction === "RL";

  // Position nodes based on layers
  const nodePositions = new Map<string, { x: number; y: number }>();

  if (isVertical) {
    // Vertical layout: layers go top-to-bottom, nodes spread horizontally
    for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
      const layer = layers[layerIdx];
      const count = layer.length;
      const totalWidth = count * NODE_W + (count - 1) * NODE_GAP;
      const startX = -totalWidth / 2;

      for (let i = 0; i < count; i++) {
        const id = layer[i];
        const x = startX + i * (NODE_W + NODE_GAP) + NODE_W / 2;
        const y = isReversed
          ? (layers.length - 1 - layerIdx) * (NODE_H + LAYER_GAP) + NODE_H / 2
          : layerIdx * (NODE_H + LAYER_GAP) + NODE_H / 2;
        nodePositions.set(id, { x, y });
      }
    }
  } else {
    // Horizontal layout: layers go left-to-right, nodes spread vertically
    for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
      const layer = layers[layerIdx];
      const count = layer.length;
      const totalHeight = count * NODE_H + (count - 1) * NODE_GAP;
      const startY = -totalHeight / 2;

      for (let i = 0; i < count; i++) {
        const id = layer[i];
        const x = isReversed
          ? (layers.length - 1 - layerIdx) * (NODE_W + LAYER_GAP) + NODE_W / 2
          : layerIdx * (NODE_W + LAYER_GAP) + NODE_W / 2;
        const y = startY + i * (NODE_H + NODE_GAP) + NODE_H / 2;
        nodePositions.set(id, { x, y });
      }
    }
  }

  // Algorithm-specific adjustments
  switch (algorithm) {
    case "circular":
    case "elk-radial": {
      // Place nodes in concentric circles based on layer
      const nodeIds = Array.from(nodes.keys());
      const centerX = 0;
      const centerY = 0;
      nodeIds.forEach((id, i) => {
        const angle = (i / nodeIds.length) * 2 * Math.PI - Math.PI / 2;
        const radius = 200 + Math.floor(i / 8) * 150;
        nodePositions.set(id, {
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
        });
      });
      break;
    }
    case "bus": {
      // Nodes alternate sides of a central vertical bus line
      const nodeIds = Array.from(nodes.keys());
      const busX = 0;
      nodeIds.forEach((id, i) => {
        const side = i % 2 === 0 ? -1 : 1;
        nodePositions.set(id, {
          x: busX + side * (NODE_W / 2 + 30),
          y: i * (NODE_H + 25) + NODE_H / 2,
        });
      });
      break;
    }
  }

  // Run a few force iterations to reduce crossings and improve spacing
  const forceNodes = Array.from(nodePositions.entries()).map(([id, pos]) => ({
    id,
    x: pos.x,
    y: pos.y,
  }));

  const forceLinks = edges
    .filter((e) => nodePositions.has(e.source) && nodePositions.has(e.target))
    .map((e) => ({ source: e.source, target: e.target }));

  if (forceNodes.length > 0) {
    const sim = d3.forceSimulation(forceNodes as any)
      .force("link", d3.forceLink(forceLinks as any).id((d: any) => d.id).distance(120).strength(0.3))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("collision", d3.forceCollide().radius(60))
      .alphaDecay(0.1)
      .stop();

    sim.tick(80);

    // Update positions
    for (const fn of forceNodes) {
      nodePositions.set(fn.id, { x: fn.x, y: fn.y });
    }
  }

  // Normalize: shift all positions so min is at PADDING
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [, pos] of nodePositions) {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x);
    maxY = Math.max(maxY, pos.y);
  }

  const shiftX = PADDING - minX + NODE_W / 2;
  const shiftY = PADDING - minY + NODE_H / 2;

  for (const [id, pos] of nodePositions) {
    nodePositions.set(id, { x: pos.x + shiftX, y: pos.y + shiftY });
  }

  // Build result
  const resultNodes: LayoutNode[] = [];
  for (const [id, pos] of nodePositions) {
    resultNodes.push({ id, label: nodes.get(id) || id, x: pos.x, y: pos.y });
  }

  const resultEdges: LayoutEdge[] = [];
  for (const e of edges) {
    const src = nodePositions.get(e.source);
    const tgt = nodePositions.get(e.target);
    if (!src || !tgt) continue;
    resultEdges.push({
      points: [{ x: src.x, y: src.y }, { x: tgt.x, y: tgt.y }],
      label: e.label,
    });
  }

  // Recalculate bounds after shifting
  minX = Infinity; minY = Infinity; maxX = -Infinity; maxY = -Infinity;
  for (const n of resultNodes) {
    minX = Math.min(minX, n.x - NODE_W / 2);
    minY = Math.min(minY, n.y - NODE_H / 2);
    maxX = Math.max(maxX, n.x + NODE_W / 2);
    maxY = Math.max(maxY, n.y + NODE_H / 2);
  }

  return {
    nodes: resultNodes,
    edges: resultEdges,
    width: maxX - minX + PADDING * 2,
    height: maxY - minY + PADDING * 2,
  };
}

// ──────────────────────────── SVG Renderer ───────────────────────────────────

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function renderMultilineText(cx: number, cy: number, text: string, fontSize: number, fill: string): string {
  const lines = text.split(/<br\s*\/?>|\n/).filter(Boolean);
  if (lines.length <= 1) {
    return `<text x="${cx}" y="${cy + fontSize * 0.35}" fill="${fill}" font-size="${fontSize}" text-anchor="middle" dominant-baseline="middle" pointer-events="none">${escapeXml(text)}</text>`;
  }
  const lineH = fontSize * 1.3;
  const totalH = lines.length * lineH;
  const startY = cy - totalH / 2 + lineH / 2;
  return lines.map((line, i) =>
    `<text x="${cx}" y="${startY + i * lineH + fontSize * 0.35}" fill="${fill}" font-size="${fontSize}" text-anchor="middle" pointer-events="none">${escapeXml(line)}</text>`
  ).join("");
}

export function renderSVG(result: LayoutResult, theme: string = "dark"): string {
  const { nodes, edges, width, height } = result;
  const isDark = theme === "dark" || theme === "observatory" || theme === "dracula" || theme === "nord";
  const nodeFill = isDark ? "#1e293b" : "#ffffff";
  const nodeStroke = isDark ? "#38bdf8" : "#3b82f6";
  const edgeColor = isDark ? "#0ea5e9" : "#64748b";
  const textColor = isDark ? "#e2e8f0" : "#1e293b";
  const labelBg = isDark ? "#0f172a" : "#f1f5f9";
  const bgFill = isDark ? "#0d1117" : "#fafbfc";

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" font-family="'JetBrains Mono', 'Fira Code', monospace">`;
  svg += `<rect width="${width}" height="${height}" fill="${bgFill}" />`;
  svg += `<defs>
    <marker id="ah" viewBox="0 0 10 7" refX="9" refY="3.5" markerWidth="6" markerHeight="5" orient="auto-start-reverse">
      <polygon points="0 0, 10 3.5, 0 7" fill="${edgeColor}" />
    </marker>
  </defs>`;

  // Edges first
  for (const e of edges) {
    const pts = e.points.map((p) => `${p.x},${p.y}`).join(" ");
    svg += `<polyline points="${pts}" fill="none" stroke="${edgeColor}" stroke-width="1.5" marker-end="url(#ah)" />`;
    if (e.label) {
      const mid = e.points[Math.floor(e.points.length / 2)];
      svg += `<rect x="${mid.x - 20}" y="${mid.y - 8}" width="40" height="14" fill="${labelBg}" rx="3" opacity="0.9" />`;
      svg += `<text x="${mid.x}" y="${mid.y + 2}" fill="${textColor}" font-size="9" text-anchor="middle">${escapeXml(e.label)}</text>`;
    }
  }

  // Nodes (text is SIBLING of rect)
  for (const n of nodes) {
    const x = n.x - NODE_W / 2;
    const y = n.y - NODE_H / 2;
    svg += `<rect x="${x}" y="${y}" width="${NODE_W}" height="${NODE_H}" rx="6" fill="${nodeFill}" stroke="${nodeStroke}" stroke-width="1.5" />`;
    svg += renderMultilineText(n.x, n.y, n.label, 11, textColor);
  }

  svg += "</svg>";
  return svg;
}
