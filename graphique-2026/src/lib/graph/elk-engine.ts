// ─────────────────────────────────────────────────────────────────────────────
// GRAPHIQUE 2026 — Layout Engine (d3-dag + d3-force)
// Implements yFiles-style layouts: Hierarchic, Orthogonal, Organic, Radial,
// Circular, Tree, Balloon, Edge Router, Bus Routing.
// ─────────────────────────────────────────────────────────────────────────────

import { graphDag, sugiyama, decrossOpt, coordVert } from "d3-dag";
import * as d3 from "d3";

const NODE_W = 140;
const NODE_H = 48;
const NODE_GAP = 40;
const LAYER_GAP = 90;
const PADDING = 50;

// ─────────────────────────────── Parser ──────────────────────────────────────

interface ParsedGraph {
  nodes: Map<string, string>;  // id -> label
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

    // Strip bracket content to get clean node IDs for edge matching
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

// ──────────────────────────── Layout Interface ───────────────────────────────

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

// ──────────────────────────── Hierarchic (Sugiyama) ─────────────────────────

function layoutHierarchic(parsed: ParsedGraph, direction: string): LayoutResult {
  const nodeList = Array.from(parsed.nodes.entries()).map(([id, label]) => ({ id, label }));
  const dag = graphDag(nodeList, parsed.edges);
  const isVertical = direction === "TB" || direction === "BT";

  sugiyama()
    .nodeSize(() => [NODE_W + NODE_GAP, NODE_H + LAYER_GAP])
    .decross(decrossOpt())
    .coord(coordVert())
    (dag);

  return extractDAGLayout(dag, parsed.nodes, parsed.edges, isVertical);
}

// ──────────────────────────── Tree Layout ────────────────────────────────────

function layoutTree(parsed: ParsedGraph, direction: string): LayoutResult {
  const nodeList = Array.from(parsed.nodes.entries()).map(([id, label]) => ({ id, label }));
  const dag = graphDag(nodeList, parsed.edges);
  const isVertical = direction === "TB" || direction === "BT";

  sugiyama()
    .nodeSize(() => [NODE_W + NODE_GAP * 1.5, NODE_H + LAYER_GAP])
    .decross(decrossOpt())
    .coord(coordVert())
    (dag);

  return extractDAGLayout(dag, parsed.nodes, parsed.edges, isVertical);
}

// ──────────────────────────── Organic (Force-Directed) ───────────────────────

function layoutOrganic(parsed: ParsedGraph): LayoutResult {
  const nodeArray = Array.from(parsed.nodes.entries()).map(([id, label]) => ({ id, label }));
  const nodes = nodeArray.map((n) => ({ ...n, x: 0, y: 0, vx: 0, vy: 0 }));
  const links = parsed.edges.map((e) => ({ source: e.source, target: e.target }));

  const sim = d3.forceSimulation(nodes as any)
    .force("link", d3.forceLink(links as any).id((d: any) => d.id).distance(120).strength(0.4))
    .force("charge", d3.forceManyBody().strength(-400))
    .force("center", d3.forceCenter(0, 0))
    .force("collision", d3.forceCollide().radius(60))
    .alphaDecay(0.02)
    .stop();

  sim.tick(300);

  return buildResult(nodes, links, parsed.edges);
}

// ──────────────────────────── Radial Layout ──────────────────────────────────

function layoutRadial(parsed: ParsedGraph): LayoutResult {
  const nodes = Array.from(parsed.nodes.entries()).map(([id, label]) => ({ id, label, x: 0, y: 0 }));
  const links = parsed.edges.map((e) => ({ source: e.source, target: e.target }));

  // Compute layers via BFS from first node
  const adj = new Map<string, string[]>();
  nodes.forEach((n) => adj.set(n.id, []));
  links.forEach((l) => {
    adj.get(l.source)?.push(l.target);
    adj.get(l.target)?.push(l.source);
  });

  const layers = new Map<string, number>();
  const queue = [nodes[0].id];
  layers.set(nodes[0].id, 0);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const layer = layers.get(cur)!;
    for (const nb of adj.get(cur) || []) {
      if (!layers.has(nb)) {
        layers.set(nb, layer + 1);
        queue.push(nb);
      }
    }
  }

  // Place nodes on concentric circles
  const layerNodes = new Map<number, string[]>();
  nodes.forEach((n) => {
    const l = layers.get(n.id) || 0;
    if (!layerNodes.has(l)) layerNodes.set(l, []);
    layerNodes.get(l)!.push(n.id);
  });

  const layerGap = LAYER_GAP + NODE_H;
  const nodeGap = NODE_W + NODE_GAP;

  layerNodes.forEach((ids, layer) => {
    const radius = layer * layerGap + 100;
    ids.forEach((id, i) => {
      const angle = (i / ids.length) * 2 * Math.PI - Math.PI / 2;
      const node = nodes.find((n) => n.id === id)!;
      node.x = Math.cos(angle) * radius;
      node.y = Math.sin(angle) * radius;
    });
  });

  // Run force to clean up
  const sim = d3.forceSimulation(nodes as any)
    .force("link", d3.forceLink(links as any).id((d: any) => d.id).distance(80).strength(0.3))
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(0, 0).strength(0.05))
    .force("collision", d3.forceCollide().radius(50))
    .alphaDecay(0.05)
    .stop();

  sim.tick(150);

  return buildResult(nodes, links, parsed.edges);
}

// ──────────────────────────── Circular Layout ────────────────────────────────

function layoutCircular(parsed: ParsedGraph): LayoutResult {
  const nodes = Array.from(parsed.nodes.entries()).map(([id, label]) => ({ id, label, x: 0, y: 0 }));
  const links = parsed.edges.map((e) => ({ source: e.source, target: e.target }));

  const n = nodes.length;
  const radius = Math.max(n * (NODE_W + NODE_GAP) / (2 * Math.PI), 150);

  nodes.forEach((node, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    node.x = Math.cos(angle) * radius;
    node.y = Math.sin(angle) * radius;
  });

  // Light force to reduce crossings
  const sim = d3.forceSimulation(nodes as any)
    .force("link", d3.forceLink(links as any).id((d: any) => d.id).distance(100).strength(0.2))
    .force("charge", d3.forceManyBody().strength(-150))
    .force("center", d3.forceCenter(0, 0).strength(0.03))
    .force("collision", d3.forceCollide().radius(50))
    .alphaDecay(0.08)
    .stop();

  sim.tick(100);

  return buildResult(nodes, links, parsed.edges);
}

// ──────────────────────────── Orthogonal Layout ──────────────────────────────

function layoutOrthogonal(parsed: ParsedGraph, direction: string): LayoutResult {
  const nodeList = Array.from(parsed.nodes.entries()).map(([id, label]) => ({ id, label }));
  const dag = graphDag(nodeList, parsed.edges);
  const isVertical = direction === "TB" || direction === "BT";

  sugiyama()
    .nodeSize(() => [NODE_W + NODE_GAP * 2, NODE_H + LAYER_GAP * 1.5])
    .decross(decrossOpt())
    .coord(coordVert())
    (dag);

  // After sugiyama, snap positions to grid
  const gridSize = NODE_W + NODE_GAP;
  const gridY = NODE_H + LAYER_GAP;

  for (const node of dag.descendants()) {
    node.x = Math.round(node.x! / gridSize) * gridSize;
    node.y = Math.round(node.y! / gridY) * gridY;
  }

  const result = extractDAGLayout(dag, parsed.nodes, parsed.edges, isVertical);

  // Add orthogonal edge routing (right angles)
  for (const edge of result.edges) {
    if (edge.points.length === 2) {
      const [start, end] = edge.points;
      edge.points = [
        start,
        { x: end.x, y: start.y }, // horizontal then vertical
        end,
      ];
    }
  }

  return result;
}

// ──────────────────────────── Balloon Layout ─────────────────────────────────

function layoutBalloon(parsed: ParsedGraph): LayoutResult {
  const nodeList = Array.from(parsed.nodes.entries()).map(([id, label]) => ({ id, label }));
  const dag = graphDag(nodeList, parsed.edges);

  // Build adjacency for tree structure
  const children = new Map<string, string[]>();
  dag.descendants().forEach((n) => children.set(n.data.id || n.data.label, []));

  for (const link of dag.links()) {
    const srcId = (link.source as any).data?.id || (link.source as any).data?.label;
    const tgtId = (link.target as any).data?.id || (link.target as any).data?.label;
    if (srcId && tgtId) children.get(srcId)?.push(tgtId);
  }

  const nodes: { id: string; label: string; x: number; y: number }[] = [];
  const root = dag.descendants()[0];
  if (!root) return { nodes: [], edges: [], width: 400, height: 300 };

  const rootId = root.data.id || root.data.label;
  const rootLabel = root.data.label || root.data.id;
  nodes.push({ id: rootId, label: rootLabel, x: 0, y: 0 });

  // Place subtrees radially
  const childIds = children.get(rootId) || [];
  const angleStep = (2 * Math.PI) / childIds.length;
  const subtreeRadius = 200;

  childIds.forEach((childId, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const cx = Math.cos(angle) * subtreeRadius;
    const cy = Math.sin(angle) * subtreeRadius;

    const childNode = dag.descendants().find((n) => (n.data.id || n.data.label) === childId);
    if (childNode) {
      nodes.push({
        id: childId,
        label: childNode.data.label || childId,
        x: cx,
        y: cy,
      });

      // Place grandchildren radially around parent
      const grandchildren = children.get(childId) || [];
      grandchildren.forEach((gcId, j) => {
        const ga = angle + (j - (grandchildren.length - 1) / 2) * 0.4;
        const gr = 120;
        const gcx = cx + Math.cos(ga) * gr;
        const gcy = cy + Math.sin(ga) * gr;
        const gcNode = dag.descendants().find((n) => (n.data.id || n.data.label) === gcId);
        if (gcNode) {
          nodes.push({ id: gcId, label: gcNode.data.label || gcId, x: gcx, y: gcy });
        }
      });
    }
  });

  const links = parsed.edges.map((e) => ({ source: e.source, target: e.target }));
  return buildResult(nodes, links, parsed.edges);
}

// ──────────────────────────── Bus Routing ─────────────────────────────────────

function layoutBus(parsed: ParsedGraph, direction: string): LayoutResult {
  const nodeList = Array.from(parsed.nodes.entries()).map(([id, label]) => ({ id, label }));
  const isVertical = direction === "TB" || direction === "BT";

  const nodes: { id: string; label: string; x: number; y: number }[] = [];
  const busOffset = isVertical ? 0 : 0;

  nodeList.forEach((n, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    if (isVertical) {
      nodes.push({
        id: n.id,
        label: n.label,
        x: side * (NODE_W / 2 + NODE_GAP + 20),
        y: i * (NODE_H + 20),  // Tight: only 20px gap between nodes
      });
    } else {
      nodes.push({
        id: n.id,
        label: n.label,
        x: i * (NODE_W + LAYER_GAP),
        y: side * (NODE_H / 2 + NODE_GAP + 20),
      });
    }
  });

  const links = parsed.edges.map((e) => ({ source: e.source, target: e.target }));
  const result = buildResult(nodes, links, parsed.edges);

  // Route edges through central bus
  for (const edge of result.edges) {
    if (edge.points.length === 2) {
      const [start, end] = edge.points;
      const busX = 0;
      const busY = 0;
      edge.points = [
        start,
        { x: isVertical ? busX : end.x, y: isVertical ? start.y : busY },
        { x: isVertical ? busX : end.x, y: isVertical ? end.y : busY },
        end,
      ];
    }
  }

  return result;
}

// ──────────────────────────── Edge Router ─────────────────────────────────────

function layoutEdgeRouter(parsed: ParsedGraph, direction: string): LayoutResult {
  // First get a base layout, then re-route edges orthogonally
  const base = layoutHierarchic(parsed, direction);

  for (const edge of base.edges) {
    if (edge.points.length === 2) {
      const [start, end] = edge.points;
      // Route: horizontal then vertical (L-shape)
      edge.points = [
        start,
        { x: end.x, y: start.y },
        end,
      ];
    }
  }

  return base;
}

// ──────────────────────────── Helpers ────────────────────────────────────────

function extractDAGLayout(
  dag: any,
  nodeMap: Map<string, string>,
  edgeList: { source: string; target: string; label?: string }[],
  isVertical: boolean
): LayoutResult {
  const nodes: LayoutNode[] = [];
  for (const node of dag.descendants()) {
    const id = node.data.id || node.data.label;
    const label = node.data.label || node.data.id;
    nodes.push({ id, label, x: node.x!, y: node.y! });
  }

  const edges: LayoutEdge[] = [];
  for (const link of dag.links()) {
    const src = link.source;
    const tgt = link.target;
    if (!src || !tgt) continue;
    edges.push({
      points: [
        { x: src.x!, y: src.y! },
        { x: tgt.x!, y: tgt.y! },
      ],
      label: (link.data as { label?: string })?.label,
    });
  }

  return buildResultFromNodes(nodes, edges);
}

function buildResult(
  nodes: { id: string; label: string; x: number; y: number }[],
  links: { source: string; target: string }[],
  edgeList: { source: string; target: string; label?: string }[]
): LayoutResult {
  const edges: LayoutEdge[] = links.map((l, i) => {
    const src = nodes.find((n) => n.id === l.source);
    const tgt = nodes.find((n) => n.id === l.target);
    return {
      points: src && tgt
        ? [{ x: src.x, y: src.y }, { x: tgt.x, y: tgt.y }]
        : [{ x: 0, y: 0 }, { x: 0, y: 0 }],
      label: edgeList[i]?.label,
    };
  });

  return buildResultFromNodes(nodes, edges);
}

function buildResultFromNodes(nodes: LayoutNode[], edges: LayoutEdge[]): LayoutResult {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x - NODE_W / 2);
    minY = Math.min(minY, n.y - NODE_H / 2);
    maxX = Math.max(maxX, n.x + NODE_W / 2);
    maxY = Math.max(maxY, n.y + NODE_H / 2);
  }

  return {
    nodes,
    edges,
    width: maxX - minX + PADDING * 2,
    height: maxY - minY + PADDING * 2,
  };
}

// ──────────────────────────── SVG Renderer ───────────────────────────────────

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function renderMultilineText(cx: number, cy: number, text: string, fontSize: number, fill: string, attrs: string): string {
  // Split on <br> or \n and render each line
  const lines = text.split(/<br\s*\/?>|\n/).filter(Boolean);
  if (lines.length <= 1) {
    return `<text x="${cx}" y="${cy + fontSize * 0.35}" fill="${fill}" font-size="${fontSize}" text-anchor="middle" dominant-baseline="middle" pointer-events="none" ${attrs}>${escapeXml(text)}</text>`;
  }
  const lineH = fontSize * 1.3;
  const totalH = lines.length * lineH;
  const startY = cy - totalH / 2 + lineH / 2;
  return lines.map((line, i) =>
    `<text x="${cx}" y="${startY + i * lineH + fontSize * 0.35}" fill="${fill}" font-size="${fontSize}" text-anchor="middle" pointer-events="none" ${attrs}>${escapeXml(line)}</text>`
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

  // Compute viewBox offset
  let minX = Infinity, minY = Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x - NODE_W / 2);
    minY = Math.min(minY, n.y - NODE_H / 2);
  }
  const ox = PADDING - minX;
  const oy = PADDING - minY;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" font-family="'JetBrains Mono', 'Fira Code', monospace">`;
  svg += `<rect width="${width}" height="${height}" fill="${bgFill}" />`;
  svg += `<defs>
    <marker id="ah" viewBox="0 0 10 7" refX="9" refY="3.5" markerWidth="6" markerHeight="5" orient="auto-start-reverse">
      <polygon points="0 0, 10 3.5, 0 7" fill="${edgeColor}" />
    </marker>
  </defs>`;

  // Edges
  for (const e of edges) {
    const pts = e.points.map((p) => `${p.x + ox},${p.y + oy}`).join(" ");
    svg += `<polyline points="${pts}" fill="none" stroke="${edgeColor}" stroke-width="1.5" marker-end="url(#ah)" />`;
    if (e.label) {
      const mid = e.points[Math.floor(e.points.length / 2)];
      const mx = mid.x + ox;
      const my = mid.y + oy;
      svg += `<rect x="${mx - 20}" y="${my - 8}" width="40" height="14" fill="${labelBg}" rx="3" opacity="0.9" />`;
      svg += `<text x="${mx}" y="${my + 2}" fill="${textColor}" font-size="9" text-anchor="middle">${escapeXml(e.label)}</text>`;
    }
  }

  // Nodes (text is SIBLING of rect, never child)
  const r = 6;
  for (const n of nodes) {
    const x = n.x + ox - NODE_W / 2;
    const y = n.y + oy - NODE_H / 2;
    svg += `<rect x="${x}" y="${y}" width="${NODE_W}" height="${NODE_H}" rx="${r}" fill="${nodeFill}" stroke="${nodeStroke}" stroke-width="1.5" />`;
    svg += renderMultilineText(n.x + ox, n.y + oy + 1, n.label, 11, textColor, '');
  }

  svg += "</svg>";
  return svg;
}

// ──────────────────────────── Main Entry ─────────────────────────────────────

export function computeLayout(
  code: string,
  algorithm: string,
  direction: string
): LayoutResult {
  const parsed = parseGraph(code);
  if (parsed.nodes.size === 0) return { nodes: [], edges: [], width: 400, height: 300 };

  switch (algorithm) {
    case "hierarchical":
    case "elk-layered":
      return layoutHierarchic(parsed, direction);
    case "tree":
    case "elk-mrtree":
      return layoutTree(parsed, direction);
    case "force":
    case "elk-force":
      return layoutOrganic(parsed);
    case "circular":
    case "elk-radial":
      return algorithm === "circular" ? layoutCircular(parsed) : layoutRadial(parsed);
    case "orthogonal":
      return layoutOrthogonal(parsed, direction);
    case "bus":
      return layoutBus(parsed, direction);
    default:
      return layoutHierarchic(parsed, direction);
  }
}
