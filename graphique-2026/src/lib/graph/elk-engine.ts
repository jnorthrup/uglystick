// ─────────────────────────────────────────────────────────────────────────────
// GRAPHIQUE 2026 — D3 Force Layout Engine
// Pure d3-force with proper edge routing, scaling, and clean SVG output.
// ─────────────────────────────────────────────────────────────────────────────

import * as d3 from "d3";

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  layer: number;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  id: string;
  source: string;
  target: string;
  label?: string;
}

const NODE_W = 140;
const NODE_H = 48;
const PADDING = 40;

function parseGraph(code: string): { nodes: { id: string; label: string }[]; edges: { id: string; source: string; target: string; label?: string }[] } {
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

function computeLayers(nodes: { id: string }[], links: SimLink[]): Map<string, number> {
  const adj = new Map<string, string[]>();
  const inDeg = new Map<string, number>();
  const ids = new Set(nodes.map((n) => n.id));

  nodes.forEach((n) => { adj.set(n.id, []); inDeg.set(n.id, 0); });

  for (const l of links) {
    if (ids.has(l.source) && ids.has(l.target)) {
      adj.get(l.source)!.push(l.target);
      inDeg.set(l.target, (inDeg.get(l.target) || 0) + 1);
    }
  }

  const queue: string[] = [];
  const layers = new Map<string, number>();

  nodes.forEach((n) => {
    if ((inDeg.get(n.id) || 0) === 0) {
      queue.push(n.id);
      layers.set(n.id, 0);
    }
  });

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const layer = layers.get(cur)!;
    for (const nb of adj.get(cur) || []) {
      const nl = layer + 1;
      if (!layers.has(nb) || layers.get(nb)! < nl) layers.set(nb, nl);
      inDeg.set(nb, inDeg.get(nb)! - 1);
      if (inDeg.get(nb) === 0) queue.push(nb);
    }
  }

  nodes.forEach((n) => { if (!layers.has(n.id)) layers.set(n.id, 0); });
  return layers;
}

function edgeIntersect(
  cx: number, cy: number,
  tx: number, ty: number,
  w: number, h: number
): { x: number; y: number } {
  // Find where line from (cx,cy) to (tx,ty) intersects the rectangle centered at (tx,ty)
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: tx, y: ty };

  const hw = w / 2;
  const hh = h / 2;

  let t = Infinity;
  if (dx !== 0) {
    const t1 = (hw) / Math.abs(dx);
    const t2 = (-hw) / Math.abs(dx);
    t = Math.min(t > 0 ? t : Infinity, t1 > 0 ? t1 : Infinity, t2 > 0 ? t2 : Infinity);
  }
  if (dy !== 0) {
    const t1 = (hh) / Math.abs(dy);
    const t2 = (-hh) / Math.abs(dy);
    t = Math.min(t, t1 > 0 ? t1 : Infinity, t2 > 0 ? t2 : Infinity);
  }
  if (t === Infinity) return { x: tx, y: ty };

  return { x: cx + dx * t, y: cy + dy * t };
}

export interface LayoutResult {
  nodes: { id: string; label: string; x: number; y: number }[];
  edges: { sourceX: number; sourceY: number; targetX: number; targetY: number; label?: string }[];
  viewBox: { x: number; y: number; w: number; h: number };
}

export function computeLayout(
  code: string,
  algorithm: string,
  direction: string
): LayoutResult {
  const { nodes: nodeList, edges: edgeList } = parseGraph(code);
  if (nodeList.length === 0) return { nodes: [], edges: [], viewBox: { x: 0, y: 0, w: 400, h: 300 } };

  const isVertical = direction === "TB" || direction === "BT";
  const simNodes: SimNode[] = nodeList.map((n) => ({ id: n.id, label: n.label, layer: 0 }));
  const simLinks: SimLink[] = edgeList.map((e) => ({ ...e }));

  const layers = computeLayers(nodeList, simLinks);
  simNodes.forEach((n) => { n.layer = layers.get(n.id) ?? 0; });

  const layerCount = Math.max(...simNodes.map((n) => n.layer), 0) + 1;
  const maxInLayer = Math.max(...Array.from(layers.values()).reduce((acc: number[], l) => {
    acc[l] = (acc[l] || 0) + 1;
    return acc;
  }, []), 1);

  // Canvas size based on graph dimensions
  const canvasW = Math.max(maxInLayer * (NODE_W + 50) + PADDING * 2, 500);
  const canvasH = Math.max(layerCount * (NODE_H + 80) + PADDING * 2, 300);

  const sim = d3.forceSimulation<SimNode>(simNodes)
    .alphaDecay(0.02)
    .velocityDecay(0.4)
    .force("charge", d3.forceManyBody().strength(-300))
    .force("collision", d3.forceCollide().radius(Math.max(NODE_W, NODE_H) / 2 + 10))
    .stop();

  // Per-algorithm force configs
  switch (algorithm) {
    case "hierarchical":
    case "elk-layered":
      sim.force("layer", isVertical
        ? d3.forceY((d) => d.layer * (NODE_H + 80) + PADDING + NODE_H / 2).strength(1.0)
        : d3.forceX((d) => d.layer * (NODE_W + 80) + PADDING + NODE_W / 2).strength(1.0)
      );
      sim.force("cross", isVertical
        ? d3.forceX(canvasW / 2).strength(0.05)
        : d3.forceY(canvasH / 2).strength(0.05)
      );
      sim.force("link", d3.forceLink(simLinks).id((d) => d.id).distance(60).strength(0.6));
      break;

    case "tree":
    case "elk-mrtree":
      sim.force("layer", isVertical
        ? d3.forceY((d) => d.layer * (NODE_H + 80) + PADDING + NODE_H / 2).strength(1.0)
        : d3.forceX((d) => d.layer * (NODE_W + 80) + PADDING + NODE_W / 2).strength(1.0)
      );
      sim.force("spread", isVertical
        ? d3.forceX((d) => {
            const siblings = simNodes.filter((n) => n.layer === d.layer);
            const idx = siblings.indexOf(d);
            return PADDING + NODE_W / 2 + idx * (NODE_W + 50);
          }).strength(0.8)
        : d3.forceY((d) => {
            const siblings = simNodes.filter((n) => n.layer === d.layer);
            const idx = siblings.indexOf(d);
            return PADDING + NODE_H / 2 + idx * (NODE_H + 40);
          }).strength(0.8)
      );
      sim.force("link", d3.forceLink(simLinks).id((d) => d.id).distance(60).strength(0.7));
      break;

    case "force":
    case "elk-force":
      sim.force("link", d3.forceLink(simLinks).id((d) => d.id).distance(120).strength(0.4));
      sim.force("charge", d3.forceManyBody().strength(-500));
      sim.force("center", d3.forceCenter(canvasW / 2, canvasH / 2));
      break;

    case "circular":
    case "elk-radial": {
      const radius = Math.min(canvasW, canvasH) * 0.35;
      simNodes.forEach((n, i) => {
        const a = (i / simNodes.length) * 2 * Math.PI - Math.PI / 2;
        n.x = canvasW / 2 + Math.cos(a) * radius;
        n.y = canvasH / 2 + Math.sin(a) * radius;
      });
      sim.force("link", d3.forceLink(simLinks).id((d) => d.id).distance(100).strength(0.2));
      sim.force("charge", d3.forceManyBody().strength(-200));
      sim.force("center", d3.forceCenter(canvasW / 2, canvasH / 2).strength(0.08));
      break;
    }

    case "orthogonal":
      sim.force("layer", isVertical
        ? d3.forceY((d) => d.layer * (NODE_H + 80) + PADDING + NODE_H / 2).strength(1.0)
        : d3.forceX((d) => d.layer * (NODE_W + 80) + PADDING + NODE_W / 2).strength(1.0)
      );
      sim.force("snap", isVertical
        ? d3.forceX((d) => {
            const siblings = simNodes.filter((n) => n.layer === d.layer);
            const idx = siblings.indexOf(d);
            return PADDING + NODE_W / 2 + idx * (NODE_W + 50);
          }).strength(0.5)
        : d3.forceY((d) => {
            const siblings = simNodes.filter((n) => n.layer === d.layer);
            const idx = siblings.indexOf(d);
            return PADDING + NODE_H / 2 + idx * (NODE_H + 40);
          }).strength(0.5)
      );
      sim.force("link", d3.forceLink(simLinks).id((d) => d.id).distance(60).strength(0.6));
      break;

    case "bus": {
      const busPos = isVertical ? canvasW / 2 : canvasH / 2;
      sim.force("layer", isVertical
        ? d3.forceY((d, i) => i * (NODE_H + 60) + PADDING + NODE_H / 2).strength(1.0)
        : d3.forceX((d, i) => i * (NODE_W + 60) + PADDING + NODE_W / 2).strength(1.0)
      );
      sim.force("bus", isVertical
        ? d3.forceX((d, i) => i % 2 === 0 ? busPos - NODE_W / 2 - 30 : busPos + NODE_W / 2 + 30).strength(0.9)
        : d3.forceY((d, i) => i % 2 === 0 ? busPos - NODE_H / 2 - 30 : busPos + NODE_H / 2 + 30).strength(0.9)
      );
      sim.force("link", d3.forceLink(simLinks).id((d) => d.id).distance(40).strength(0.3));
      sim.force("charge", d3.forceManyBody().strength(-100));
      break;
    }

    default:
      sim.force("link", d3.forceLink(simLinks).id((d) => d.id).distance(80).strength(0.5));
      sim.force("center", d3.forceCenter(canvasW / 2, canvasH / 2));
  }

  sim.tick(300);

  // Build result with proper edge connections (edge-to-edge, not center-to-center)
  const nodes = simNodes.map((n) => ({
    id: n.id,
    label: n.label,
    x: n.x ?? canvasW / 2,
    y: n.y ?? canvasH / 2,
  }));

  const edges = edgeList.map((e) => {
    const src = nodes.find((n) => n.id === e.source)!;
    const tgt = nodes.find((n) => n.id === e.target)!;
    if (!src || !tgt) return { sourceX: 0, sourceY: 0, targetX: 0, targetY: 0, label: e.label };

    const from = edgeIntersect(src.x, src.y, tgt.x, tgt.y, NODE_W, NODE_H);
    const to = edgeIntersect(tgt.x, tgt.y, src.x, src.y, NODE_W, NODE_H);
    return { sourceX: from.x, sourceY: from.y, targetX: to.x, targetY: to.y, label: e.label };
  });

  // Compute viewBox with padding
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
    viewBox: {
      x: minX - PADDING,
      y: minY - PADDING,
      w: maxX - minX + PADDING * 2,
      h: maxY - minY + PADDING * 2,
    },
  };
}

export function renderSVG(result: LayoutResult, theme: string = "dark"): string {
  const { viewBox, nodes, edges } = result;
  const vb = `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`;

  const isDark = theme === "dark" || theme === "observatory" || theme === "dracula" || theme === "nord";
  const nodeFill = isDark ? "#1e293b" : "#ffffff";
  const nodeStroke = isDark ? "#38bdf8" : "#3b82f6";
  const edgeColor = isDark ? "#0ea5e9" : "#64748b";
  const textColor = isDark ? "#e2e8f0" : "#1e293b";
  const labelBg = isDark ? "#0f172a" : "#f1f5f9";
  const bgFill = isDark ? "#0d1117" : "#fafbfc";

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="100%" height="100%" font-family="'JetBrains Mono', 'Fira Code', monospace" style="background:${bgFill}">`;

  svg += `<defs>
    <marker id="ah" viewBox="0 0 10 7" refX="9" refY="3.5" markerWidth="6" markerHeight="5" orient="auto-start-reverse">
      <polygon points="0 0, 10 3.5, 0 7" fill="${edgeColor}" />
    </marker>
  </defs>`;

  // Edges
  for (const e of edges) {
    svg += `<line x1="${e.sourceX}" y1="${e.sourceY}" x2="${e.targetX}" y2="${e.targetY}" stroke="${edgeColor}" stroke-width="1.5" marker-end="url(#ah)" />`;
    if (e.label) {
      const mx = (e.sourceX + e.targetX) / 2;
      const my = (e.sourceY + e.targetY) / 2;
      svg += `<rect x="${mx - 18}" y="${my - 8}" width="36" height="14" fill="${labelBg}" rx="3" opacity="0.9" />`;
      svg += `<text x="${mx}" y="${my + 2}" fill="${textColor}" font-size="9" text-anchor="middle">${e.label}</text>`;
    }
  }

  // Nodes
  const r = 6;
  for (const n of nodes) {
    const x = n.x - NODE_W / 2;
    const y = n.y - NODE_H / 2;
    svg += `<rect x="${x}" y="${y}" width="${NODE_W}" height="${NODE_H}" rx="${r}" fill="${nodeFill}" stroke="${nodeStroke}" stroke-width="1.5" />`;
    svg += `<text x="${n.x}" y="${n.y + 1}" fill="${textColor}" font-size="11" text-anchor="middle" dominant-baseline="middle" pointer-events="none">${n.label}</text>`;
  }

  svg += "</svg>";
  return svg;
}
