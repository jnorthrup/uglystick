// ─────────────────────────────────────────────────────────────────────────────
// GRAPHIQUE 2026 — Layout Engine
// Sugiyama-style hierarchical layout with barycenter crossing reduction.
// D3 force simulation ONLY for initial placement, not for final positions.
// ─────────────────────────────────────────────────────────────────────────────

import * as d3 from "d3";
import { line, curveBasis } from "d3-shape";
import type { MermaidConfig } from "mermaid";
import type { Point, NodeShape, EdgeType, NodeStyle, GraphiqueTheme, LayoutAlgorithm } from "./types";
import type { ParsedMermaidGraph } from "./mermaid-parser";
import { detectDiagramType, injectLayoutForAlgorithm } from "./mermaid-utils";
import { parseMermaid } from "./mermaid-parser";

// ── Constants ────────────────────────────────────────────────────────────────

const NODE_W = 160;
const NODE_H = 56;
const H_GAP = 50;   // horizontal gap between nodes in same layer
const V_GAP = 90;   // vertical gap between layers
const PAD = 50;     // padding around entire diagram
const CONCENTRIC_MEMBER_GAP_X = 28;
const CONCENTRIC_MEMBER_GAP_Y = 22;

// ── Types ────────────────────────────────────────────────────────────────────

export interface LayoutNode {
  id: string;
  label: string;
  shape: NodeShape;
  x: number; // center
  y: number; // center
  w: number;
  h: number;
  layer: number;
  style?: Partial<Record<keyof NodeStyle, string | number>>;
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  edgeType: EdgeType;
  sourcePos: { x: number; y: number };
  targetPos: { x: number; y: number };
  points?: Point[];
  routeStyle?: RouteStyle;
}

interface LayoutResult {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  groups: { id: string; label: string; childIds: string[] }[];
  viewBox: { x: number; y: number; w: number; h: number };
}

type RouteStyle = "smooth" | "orthogonal" | "concentric" | "perpendicular";

interface RouteContext {
  nodeRingIndex?: Map<string, number>;
  nodeClusterId?: Map<string, string>;
  nodeClusterCenter?: Map<string, Point>;
  ringSpacing?: number;
}

interface ForceNode extends d3.SimulationNodeDatum {
  id: string;
}

// ── Topological layering (longest path on DAG) ───────────────────────────────
// DFS-based cycle detection → remove back edges → Kahn's → longest path.

function assignLayers(
  nodeIds: string[],
  edges: { source: string; target: string }[]
): { layers: string[][]; backEdges: { source: string; target: string }[] } {
  const adj = new Map<string, string[]>();
  for (const id of nodeIds) adj.set(id, []);
  for (const e of edges) {
    if (adj.has(e.source)) adj.get(e.source)?.push(e.target);
  }

  // DFS cycle detection
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const id of nodeIds) color.set(id, WHITE);
  const backEdgesList: { source: string; target: string }[] = [];

  function dfs(u: string) {
    color.set(u, GRAY);
    for (const v of adj.get(u) || []) {
      if (color.get(v) === GRAY) backEdgesList.push({ source: u, target: v });
      else if (color.get(v) === WHITE) dfs(v);
    }
    color.set(u, BLACK);
  }
  for (const id of nodeIds) if (color.get(id) === WHITE) dfs(id);

  const backEdgeSet = new Set(backEdgesList.map((e) => `${e.source}→${e.target}`));
  const dagEdges = edges.filter((e) => !backEdgeSet.has(`${e.source}→${e.target}`));

  // Kahn's on DAG edges
  const dagInDeg = new Map<string, number>();
  const dagAdj = new Map<string, string[]>();
  for (const id of nodeIds) { dagInDeg.set(id, 0); dagAdj.set(id, []); }
  for (const e of dagEdges) {
    dagAdj.get(e.source)?.push(e.target);
    dagInDeg.set(e.target, (dagInDeg.get(e.target) ?? 0) + 1);
  }

  const queue = nodeIds.filter((id) => dagInDeg.get(id) === 0);
  const topoOrder: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift();
    if (!node) break;
    topoOrder.push(node);
    for (const nb of dagAdj.get(node) || []) {
      dagInDeg.set(nb, (dagInDeg.get(nb) ?? 0) - 1);
      if (dagInDeg.get(nb) === 0) queue.push(nb);
    }
  }

  // Longest path on DAG
  const layerOf = new Map<string, number>();
  for (const id of topoOrder) {
    const preds = dagEdges.filter((e) => e.target === id);
    layerOf.set(id, preds.length === 0 ? 0 : Math.max(...preds.map((e) => layerOf.get(e.source) ?? 0)) + 1);
  }

  // Cyclic nodes
  let maxLayer = 0;
  for (const [, l] of layerOf) maxLayer = Math.max(maxLayer, l);
  for (const id of nodeIds) {
    if (!topoOrder.includes(id)) { maxLayer++; layerOf.set(id, maxLayer); }
  }
  for (const [, l] of layerOf) maxLayer = Math.max(maxLayer, l);

  // Group by layer
  const layers: string[][] = [];
  for (let li = 0; li <= maxLayer; li++) layers.push([]);
  for (const [id, li] of layerOf) layers[li].push(id);

  return { layers, backEdges: backEdgesList };
}

// ── Barycenter ordering (reduce edge crossings) ─────────────────────────────

function barycenterOrder(layers: string[][], edges: { source: string; target: string }[]): string[][] {
  if (layers.length <= 1) return layers;

  const pos = new Map<string, number>();
  for (let li = 0; li < layers.length; li++) {
    for (let i = 0; i < layers[li].length; i++) {
      pos.set(layers[li][i], i);
    }
  }

  // Sweep down then up, multiple passes
  for (let pass = 0; pass < 4; pass++) {
    // Down sweep
    for (let li = 1; li < layers.length; li++) {
      const layer = layers[li];
      const bary = layer.map((id) => {
        const preds = edges.filter((e) => e.target === id).map((e) => pos.get(e.source) ?? 0);
        return { id, b: preds.length > 0 ? preds.reduce((a, b) => a + b, 0) / preds.length : pos.get(id) ?? 0 };
      });
      bary.sort((a, b) => a.b - b.b);
      layers[li] = bary.map((x) => x.id);
      for (let i = 0; i < layers[li].length; i++) {
        pos.set(layers[li][i], i);
      }
    }

    // Up sweep
    for (let li = layers.length - 2; li >= 0; li--) {
      const layer = layers[li];
      const bary = layer.map((id) => {
        const succs = edges.filter((e) => e.source === id).map((e) => pos.get(e.target) ?? 0);
        return { id, b: succs.length > 0 ? succs.reduce((a, b) => a + b, 0) / succs.length : pos.get(id) ?? 0 };
      });
      bary.sort((a, b) => a.b - b.b);
      layers[li] = bary.map((x) => x.id);
      for (let i = 0; i < layers[li].length; i++) {
        pos.set(layers[li][i], i);
      }
    }
  }

  return layers;
}

function directionStartAngle(direction: string): number {
  switch (direction) {
    case "LR":
      return 0;
    case "BT":
      return Math.PI / 2;
    case "RL":
      return Math.PI;
    default:
      return -Math.PI / 2;
  }
}

function dedupePoints(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const point of points) {
    const prev = out[out.length - 1];
    if (!prev || prev.x !== point.x || prev.y !== point.y) {
      out.push(point);
    }
  }
  return out;
}

function average(values: number[], fallback: number): number {
  if (values.length === 0) return fallback;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

type RouteSide = "top" | "bottom" | "left" | "right";

function dominantRouteSide(pt: Point, center: Point): RouteSide {
  const dx = pt.x - center.x;
  const dy = pt.y - center.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx < 0 ? "left" : "right";
  }
  return dy < 0 ? "top" : "bottom";
}

function routeSideBias(side: RouteSide, srcPt: Point, tgtPt: Point, center: Point): number {
  const srcSide = dominantRouteSide(srcPt, center);
  const tgtSide = dominantRouteSide(tgtPt, center);
  let bias = 0;

  if (srcSide === side) bias += 28;
  if (tgtSide === side) bias += 28;
  if (srcSide === tgtSide && srcSide === side) bias += 12;
  if (srcSide === tgtSide && srcSide !== side) bias -= 8;

  if (side === "top") {
    if (srcPt.y < center.y && tgtPt.y < center.y) bias += 18;
    if (srcPt.y > center.y && tgtPt.y > center.y) bias -= 14;
  } else if (side === "bottom") {
    if (srcPt.y > center.y && tgtPt.y > center.y) bias += 18;
    if (srcPt.y < center.y && tgtPt.y < center.y) bias -= 14;
  } else if (side === "left") {
    if (srcPt.x < center.x && tgtPt.x < center.x) bias += 18;
    if (srcPt.x > center.x && tgtPt.x > center.x) bias -= 14;
  } else {
    if (srcPt.x > center.x && tgtPt.x > center.x) bias += 18;
    if (srcPt.x < center.x && tgtPt.x < center.x) bias -= 14;
  }

  return bias;
}

// ── Main layout computation ──────────────────────────────────────────────────

function layeredLayout(
  parsed: ParsedMermaidGraph,
  direction: string,
  routeStyle: RouteStyle = "smooth"
): LayoutResult {
  const nodeIds = Array.from(parsed.nodes.keys());
  const isVert = direction === "TB" || direction === "TD";
  const isRev = direction === "BT" || direction === "RL";

  const { layers } = assignLayers(nodeIds, parsed.edges);
  const orderedLayers = barycenterOrder(layers, parsed.edges);
  const pos = new Map<string, { x: number; y: number; layer: number }>();

  // 16:9 Aspect Ratio Optimization
  const TARGET_RATIO = 16 / 9;
  const numLayers = orderedLayers.length;
  const maxLayerSize = Math.max(...orderedLayers.map((l) => l.length));

  // Dynamic Gaps based on "pressure" to reach 16:9
  let dynamicHGap = H_GAP;
  let dynamicVGap = V_GAP;

  if (isVert) {
    // Current raw ratio ~ (maxLayerSize * NODE_W) / (numLayers * NODE_H)
    const rawRatio = (maxLayerSize * NODE_W) / (numLayers * NODE_H);
    if (rawRatio < TARGET_RATIO) {
      // Too portrait: increase H_GAP to push outwards
      dynamicHGap = H_GAP * (TARGET_RATIO / Math.max(0.5, rawRatio));
    } else {
      // Too panorama: increase V_GAP to push downwards
      dynamicVGap = V_GAP * (rawRatio / TARGET_RATIO);
    }
  } else {
    // LR: raw ratio ~ (numLayers * NODE_W) / (maxLayerSize * NODE_H)
    const rawRatio = (numLayers * NODE_W) / (maxLayerSize * NODE_H);
    if (rawRatio < TARGET_RATIO) {
      // Too portrait: increase V_GAP
      dynamicVGap = V_GAP * (TARGET_RATIO / Math.max(0.5, rawRatio));
    } else {
      // Too panorama: increase H_GAP
      dynamicHGap = H_GAP * (rawRatio / TARGET_RATIO);
    }
  }

  // Cap the dynamic gaps to prevent extreme layouts
  dynamicHGap = Math.min(dynamicHGap, 300);
  dynamicVGap = Math.min(dynamicVGap, 300);

  for (let li = 0; li < orderedLayers.length; li++) {
    const layer = orderedLayers[li];
    const n = layer.length;

    if (isVert) {
      const totalW = n * NODE_W + (n - 1) * dynamicHGap;
      const sx = -totalW / 2;
      const yRaw = isRev ? orderedLayers.length - 1 - li : li;
      const y = yRaw * (NODE_H + dynamicVGap);

      for (let i = 0; i < n; i++) {
        pos.set(layer[i], { x: sx + i * (NODE_W + dynamicHGap) + NODE_W / 2, y, layer: li });
      }
    } else {
      const totalH = n * NODE_H + (n - 1) * dynamicVGap;
      const sy = -totalH / 2;
      const xRaw = isRev ? orderedLayers.length - 1 - li : li;
      const x = xRaw * (NODE_W + dynamicHGap);

      for (let i = 0; i < n; i++) {
        pos.set(layer[i], { x, y: sy + i * (NODE_H + dynamicVGap) + NODE_H / 2, layer: li });
      }
    }
  }

  return buildResult(pos, parsed, direction, routeStyle);
}

function orthogonalLayout(parsed: ParsedMermaidGraph, direction: string): LayoutResult {
  return layeredLayout(parsed, direction, "orthogonal");
}

interface ConcentricCluster {
  id: string;
  label: string;
  childIds: string[];
  memberCols: number;
  memberRows: number;
  memberWidth: number;
  memberHeight: number;
  shellRadius: number;
  ring: number;
  order: number;
  angle: number;
  center: Point;
}

function concentricLayout(parsed: ParsedMermaidGraph, direction: string): LayoutResult {
  const nodeIds = Array.from(parsed.nodes.keys());
  const pos = new Map<string, { x: number; y: number; layer: number }>();
  const nodeRingIndex = new Map<string, number>();
  const nodeClusterId = new Map<string, string>();
  const nodeClusterCenter = new Map<string, Point>();

  const nodeToCluster = new Map<string, string>();
  const clusters = new Map<string, ConcentricCluster>();

  for (const group of parsed.groups) {
    if (group.childIds.length === 0) continue;
    const count = group.childIds.length;
    const memberCols = count <= 2 ? count : Math.ceil(Math.sqrt(count));
    const memberRows = Math.ceil(count / memberCols);
    const memberWidth = count <= 1
      ? NODE_W
      : memberCols * NODE_W + Math.max(0, memberCols - 1) * CONCENTRIC_MEMBER_GAP_X;
    const memberHeight = count <= 1
      ? NODE_H
      : memberRows * NODE_H + Math.max(0, memberRows - 1) * CONCENTRIC_MEMBER_GAP_Y;
    clusters.set(group.id, {
      id: group.id,
      label: group.label,
      childIds: [...group.childIds],
      memberCols,
      memberRows,
      memberWidth,
      memberHeight,
      shellRadius: Math.max(memberWidth, memberHeight) / 2 + 32,
      ring: 0,
      order: 0,
      angle: 0,
      center: { x: 0, y: 0 },
    });
    for (const childId of group.childIds) {
      nodeToCluster.set(childId, group.id);
    }
  }

  for (const nodeId of nodeIds) {
    if (nodeToCluster.has(nodeId)) continue;
    const info = parsed.nodes.get(nodeId);
    if (!info) continue;
    clusters.set(nodeId, {
      id: nodeId,
      label: info.label,
      childIds: [nodeId],
      memberCols: 1,
      memberRows: 1,
      memberWidth: NODE_W,
      memberHeight: NODE_H,
      shellRadius: Math.max(NODE_W, NODE_H) / 2 + 32,
      ring: 0,
      order: 0,
      angle: 0,
      center: { x: 0, y: 0 },
    });
    nodeToCluster.set(nodeId, nodeId);
  }

  const clusterList = [...clusters.values()];
  if (clusterList.length === 0) {
    return { nodes: [], edges: [], groups: parsed.groups, viewBox: { x: 0, y: 0, w: 400, h: 300 } };
  }

  const clusterNeighbors = new Map<string, string[]>();
  const clusterDegree = new Map<string, number>();
  const clusterInternal = new Map<string, number>();
  for (const cluster of clusterList) {
    clusterNeighbors.set(cluster.id, []);
    clusterDegree.set(cluster.id, 0);
    clusterInternal.set(cluster.id, 0);
  }

  for (const edge of parsed.edges) {
    const sourceCluster = nodeToCluster.get(edge.source);
    const targetCluster = nodeToCluster.get(edge.target);
    if (!sourceCluster || !targetCluster) continue;

    clusterDegree.set(sourceCluster, (clusterDegree.get(sourceCluster) ?? 0) + 1);
    clusterNeighbors.get(sourceCluster)?.push(targetCluster);

    if (sourceCluster === targetCluster) {
      clusterInternal.set(sourceCluster, (clusterInternal.get(sourceCluster) ?? 0) + 1);
    } else {
      clusterDegree.set(targetCluster, (clusterDegree.get(targetCluster) ?? 0) + 1);
      clusterNeighbors.get(targetCluster)?.push(sourceCluster);
    }
  }

  const clusterScores = new Map<string, number>();
  for (const cluster of clusterList) {
    const score = cluster.childIds.length * 4 + (clusterDegree.get(cluster.id) ?? 0) * 2 + (clusterInternal.get(cluster.id) ?? 0);
    clusterScores.set(cluster.id, score);
  }

  const ringCapacity = Math.max(4, Math.ceil(Math.sqrt(clusterList.length) * 1.5));
  const ringCount = Math.max(1, Math.ceil(clusterList.length / ringCapacity));
  const rings: string[][] = Array.from({ length: ringCount }, () => []);

  const seedClusters = [...clusterList].sort((a, b) => {
    const scoreDiff = (clusterScores.get(b.id) ?? 0) - (clusterScores.get(a.id) ?? 0);
    return scoreDiff !== 0 ? scoreDiff : a.label.localeCompare(b.label);
  });

  seedClusters.forEach((cluster, index) => {
    rings[Math.min(ringCount - 1, Math.floor(index / ringCapacity))].push(cluster.id);
  });

  let clusterOrderSeed = new Map<string, number>();
  seedClusters.forEach((cluster, index) => clusterOrderSeed.set(cluster.id, index));
  for (let pass = 0; pass < 3; pass++) {
    const nextRings = rings.map((ring) => {
      const scored = ring.map((id) => {
        const neighbors = clusterNeighbors.get(id) || [];
        const neighborPositions = neighbors.map((neighbor) => clusterOrderSeed.get(neighbor) ?? clusterOrderSeed.get(id) ?? 0);
        return { id, score: average(neighborPositions, clusterOrderSeed.get(id) ?? 0) };
      });
      scored.sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));
      return scored.map((entry) => entry.id);
    });
    rings.splice(0, rings.length, ...nextRings);
    clusterOrderSeed = new Map();
    let order = 0;
    for (const ring of rings) {
      for (const id of ring) {
        clusterOrderSeed.set(id, order++);
      }
    }
  }

  const maxShellRadius = clusterList.reduce((max, cluster) => Math.max(max, cluster.shellRadius), 0);
  const innerRadius = maxShellRadius + 80;
  const ringSpacing = Math.max(460, maxShellRadius * 2 + 80);
  const startAngle = directionStartAngle(direction);

  for (let ringIndex = 0; ringIndex < rings.length; ringIndex++) {
    const ring = rings[ringIndex];
    const radius = innerRadius + ringIndex * ringSpacing;
    const ringStart = startAngle + ringIndex * 0.28;

    for (let i = 0; i < ring.length; i++) {
      const cluster = clusters.get(ring[i]);
      if (!cluster) continue;
      const angle = ring.length === 1 ? ringStart : ringStart + (i / ring.length) * Math.PI * 2;
      cluster.ring = ringIndex;
      cluster.order = i;
      cluster.angle = angle;
      cluster.center = {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      };
    }
  }

  const clusterOrderMap = new Map<string, number>();
  let clusterOrder = 0;
  for (const ring of rings) {
    for (const id of ring) {
      clusterOrderMap.set(id, clusterOrder++);
    }
  }

  for (const cluster of clusterList) {
    const members = [...cluster.childIds];
    const seedOrder = new Map<string, number>();
    members.forEach((id, index) => seedOrder.set(id, index));

    const scoredMembers = members.map((id, index) => {
      const external: number[] = [];
      const internal: number[] = [];

      for (const edge of parsed.edges) {
        if (edge.source !== id && edge.target !== id) continue;
        const other = edge.source === id ? edge.target : edge.source;
        const otherCluster = nodeToCluster.get(other);
        if (!otherCluster) continue;
        if (otherCluster === cluster.id) {
          internal.push(seedOrder.get(other) ?? index);
        } else {
          external.push(clusterOrderMap.get(otherCluster) ?? 0);
        }
      }

      return {
        id,
        score: external.length > 0 ? average(external, index) : average(internal, index),
      };
    });

    scoredMembers.sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));
    const orderedMembers = scoredMembers.map((entry) => entry.id);

    if (orderedMembers.length === 1) {
      const id = orderedMembers[0];
      pos.set(id, { x: cluster.center.x, y: cluster.center.y, layer: cluster.ring });
      nodeRingIndex.set(id, cluster.ring);
      nodeClusterId.set(id, cluster.id);
      nodeClusterCenter.set(id, cluster.center);
      continue;
    }

    const rows: string[][] = Array.from({ length: cluster.memberRows }, () => []);
    orderedMembers.forEach((id, index) => {
      const rowIndex = Math.min(cluster.memberRows - 1, Math.floor(index / cluster.memberCols));
      rows[rowIndex]?.push(id);
    });

    const gridTopY = cluster.center.y - cluster.memberHeight / 2 + NODE_H / 2;
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      if (!row || row.length === 0) continue;
      const rowWidth = row.length * NODE_W + Math.max(0, row.length - 1) * CONCENTRIC_MEMBER_GAP_X;
      const rowStartX = cluster.center.x - rowWidth / 2 + NODE_W / 2;
      const rowY = gridTopY + rowIndex * (NODE_H + CONCENTRIC_MEMBER_GAP_Y);
      row.forEach((id, colIndex) => {
        pos.set(id, {
          x: rowStartX + colIndex * (NODE_W + CONCENTRIC_MEMBER_GAP_X),
          y: rowY,
          layer: cluster.ring,
        });
        nodeRingIndex.set(id, cluster.ring);
        nodeClusterId.set(id, cluster.id);
        nodeClusterCenter.set(id, cluster.center);
      });
    }
  }

  return buildResult(pos, parsed, direction, "concentric", {
    nodeRingIndex,
    nodeClusterId,
    nodeClusterCenter,
    ringSpacing,
  });
}

function computeLayout(
  parsed: ParsedMermaidGraph,
  algorithm: string,
  direction: string
): LayoutResult {
  const nodeIds = Array.from(parsed.nodes.keys());
  if (nodeIds.length === 0) {
    return { nodes: [], edges: [], groups: parsed.groups, viewBox: { x: 0, y: 0, w: 400, h: 300 } };
  }

  if (algorithm === "circular" || algorithm === "elk-radial") {
    return circularLayout(parsed, algorithm);
  }

  if (algorithm === "bus") {
    return busLayout(parsed);
  }

  if (algorithm === "hierarchical") {
    return layeredLayout(parsed, direction, "perpendicular");
  }

  if (algorithm === "force" || algorithm === "elk-force") {
    return forceLayout(parsed, direction);
  }

  if (algorithm === "orthogonal") {
    return orthogonalLayout(parsed, direction);
  }

  if (algorithm === "concentric") {
    return concentricLayout(parsed, direction);
  }

  return layeredLayout(parsed, direction);
}

// ── Force-directed layout (pure D3, no layers) ──────────────────────────────

function forceLayout(
  parsed: ParsedMermaidGraph,
  direction: string
): LayoutResult {
  const nodeIds = Array.from(parsed.nodes.keys());
  const fNodes: ForceNode[] = nodeIds.map((id) => ({
    id,
    x: 0,
    y: 0,
  }));

  const fLinks: d3.SimulationLinkDatum<ForceNode>[] = parsed.edges
    .filter((e) => nodeIds.includes(e.source) && nodeIds.includes(e.target))
    .map((e) => ({ source: e.source, target: e.target }));

  const sim = d3
    .forceSimulation<ForceNode>(fNodes)
    .force(
      "link",
      d3.forceLink<ForceNode, d3.SimulationLinkDatum<ForceNode>>(fLinks).id((d) => d.id).distance(180).strength(0.4)
    )
    .force("charge", d3.forceManyBody().strength(-400))
    .force("collide", d3.forceCollide().radius(80).strength(0.8))
    .force("center", d3.forceCenter(0, 0).strength(0.05))
    .alphaDecay(0.02)
    .stop();

  sim.tick(300);

  const pos = new Map<string, { x: number; y: number; layer: number }>();
  for (const fn of fNodes) {
    pos.set(fn.id, { x: fn.x ?? 0, y: fn.y ?? 0, layer: 0 });
  }

  return buildResult(pos, parsed, direction);
}

// ── Circular layout ─────────────────────────────────────────────────────────

function circularLayout(
  parsed: ParsedMermaidGraph,
  algorithm: string
): LayoutResult {
  const nodeIds = Array.from(parsed.nodes.keys());
  const pos = new Map<string, { x: number; y: number; layer: number }>();

  // Sort by connectivity for better visual
  const degree = new Map<string, number>();
  for (const id of nodeIds) degree.set(id, 0);
  for (const e of parsed.edges) {
    degree.set(e.source, (degree.get(e.source) || 0) + 1);
    degree.set(e.target, (degree.get(e.target) || 0) + 1);
  }

  const sorted = [...nodeIds].sort((a, b) => (degree.get(b) || 0) - (degree.get(a) || 0));
  const n = sorted.length;
  const baseR = Math.max(n * 60, 250);

  sorted.forEach((id, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    pos.set(id, { x: Math.cos(angle) * baseR, y: Math.sin(angle) * baseR, layer: 0 });
  });

  return buildResult(pos, parsed, "TB");
}

// ── Bus layout ───────────────────────────────────────────────────────────────

function busLayout(parsed: ParsedMermaidGraph): LayoutResult {
  const nodeIds = Array.from(parsed.nodes.keys());
  const pos = new Map<string, { x: number; y: number; layer: number }>();

  nodeIds.forEach((id, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    pos.set(id, { x: side * (NODE_W / 2 + 50), y: i * (NODE_H + 40), layer: i });
  });

  return buildResult(pos, parsed, "TB", "perpendicular");
}

function perpendicularRoutePoints(
  srcPt: Point,
  tgtPt: Point,
  isVert: boolean,
  lane: number,
  viewBox?: { w: number; h: number }
): Point[] {
  const TARGET_RATIO = 16 / 9;
  const laneOffset = lane * 14;
  const breakout = 30;

  // Calculate if we need to "push" edges out to satisfy 16:9
  let pushX = 0;
  let pushY = 0;

  if (viewBox) {
    const currentRatio = viewBox.w / viewBox.h;
    if (currentRatio < TARGET_RATIO) {
      // Too portrait, push edges horizontally
      pushX = (viewBox.h * TARGET_RATIO - viewBox.w) * 0.2 * (lane >= 0 ? 1 : -1);
    } else if (currentRatio > TARGET_RATIO) {
      // Too panorama, push edges vertically
      pushY = (viewBox.w / TARGET_RATIO - viewBox.h) * 0.2 * (lane >= 0 ? 1 : -1);
    }
  }

  if (isVert) {
    const midY = (srcPt.y + tgtPt.y) / 2 + laneOffset + pushY;
    const b1 = { x: srcPt.x, y: srcPt.y + (tgtPt.y > srcPt.y ? breakout : -breakout) };
    const b2 = { x: tgtPt.x, y: tgtPt.y + (srcPt.y > tgtPt.y ? breakout : -breakout) };

    // We add more points to ensure it looks "game-like" and avoids the nodes' immediate area
    return dedupePoints([
      srcPt,
      b1,
      { x: b1.x + pushX, y: b1.y },
      { x: b1.x + pushX, y: midY },
      { x: b2.x + pushX, y: midY },
      { x: b2.x + pushX, y: b2.y },
      b2,
      tgtPt
    ]);
  } else {
    const midX = (srcPt.x + tgtPt.x) / 2 + laneOffset + pushX;
    const b1 = { x: srcPt.x + (tgtPt.x > srcPt.x ? breakout : -breakout), y: srcPt.y };
    const b2 = { x: tgtPt.x + (srcPt.x > tgtPt.x ? breakout : -breakout), y: tgtPt.y };

    return dedupePoints([
      srcPt,
      b1,
      { x: b1.x, y: b1.y + pushY },
      { x: midX, y: b1.y + pushY },
      { x: midX, y: b2.y + pushY },
      { x: b2.x, y: b2.y + pushY },
      b2,
      tgtPt
    ]);
  }
}

function orthogonalRoutePoints(srcPt: Point, tgtPt: Point, isVert: boolean, lane: number): Point[] {
  const laneOffset = lane * 14;
  if (isVert) {
    const midY = (srcPt.y + tgtPt.y) / 2 + laneOffset;
    return [
      srcPt,
      { x: srcPt.x, y: midY },
      { x: tgtPt.x, y: midY },
      tgtPt,
    ];
  }

  const midX = (srcPt.x + tgtPt.x) / 2 + laneOffset;
  return [
    srcPt,
    { x: midX, y: srcPt.y },
    { x: midX, y: tgtPt.y },
    tgtPt,
  ];
}

function concentricRoutePoints(
  srcPt: Point,
  tgtPt: Point,
  center: Point,
  sourceRing: number,
  targetRing: number,
  ringSpacing: number,
  lane: number,
  sameCluster: boolean,
  preferredSide?: RouteSide
): Point[] {
  const ringDelta = Math.abs(sourceRing - targetRing);
  const basePad = sameCluster
    ? Math.max(14, Math.min(ringSpacing * 0.08, 28))
    : Math.max(18, Math.min(ringSpacing * 0.11, 40));
  const pad = basePad + lane * (sameCluster ? 8 : 10) + ringDelta * (sameCluster ? 4 : 6);
  const left = Math.min(srcPt.x, tgtPt.x);
  const right = Math.max(srcPt.x, tgtPt.x);
  const top = Math.min(srcPt.y, tgtPt.y);
  const bottom = Math.max(srcPt.y, tgtPt.y);

  const candidates: Array<{ side: RouteSide; score: number; points: Point[] }> = [
    {
      side: "top",
      score:
        Math.abs(srcPt.y - (top - pad)) +
        Math.abs(tgtPt.y - (top - pad)) +
        Math.abs(srcPt.x - tgtPt.x) -
        routeSideBias("top", srcPt, tgtPt, center) -
        (preferredSide === "top" ? (sameCluster ? 24 : 48) : 0) +
        (preferredSide && preferredSide !== "top" ? (sameCluster ? 4 : 16) : 0),
      points: [srcPt, { x: srcPt.x, y: top - pad }, { x: tgtPt.x, y: top - pad }, tgtPt],
    },
    {
      side: "bottom",
      score:
        Math.abs(srcPt.y - (bottom + pad)) +
        Math.abs(tgtPt.y - (bottom + pad)) +
        Math.abs(srcPt.x - tgtPt.x) -
        routeSideBias("bottom", srcPt, tgtPt, center) -
        (preferredSide === "bottom" ? (sameCluster ? 24 : 48) : 0) +
        (preferredSide && preferredSide !== "bottom" ? (sameCluster ? 4 : 16) : 0),
      points: [srcPt, { x: srcPt.x, y: bottom + pad }, { x: tgtPt.x, y: bottom + pad }, tgtPt],
    },
    {
      side: "left",
      score:
        Math.abs(srcPt.x - (left - pad)) +
        Math.abs(tgtPt.x - (left - pad)) +
        Math.abs(srcPt.y - tgtPt.y) -
        routeSideBias("left", srcPt, tgtPt, center) -
        (preferredSide === "left" ? (sameCluster ? 24 : 48) : 0) +
        (preferredSide && preferredSide !== "left" ? (sameCluster ? 4 : 16) : 0),
      points: [srcPt, { x: left - pad, y: srcPt.y }, { x: left - pad, y: tgtPt.y }, tgtPt],
    },
    {
      side: "right",
      score:
        Math.abs(srcPt.x - (right + pad)) +
        Math.abs(tgtPt.x - (right + pad)) +
        Math.abs(srcPt.y - tgtPt.y) -
        routeSideBias("right", srcPt, tgtPt, center) -
        (preferredSide === "right" ? (sameCluster ? 24 : 48) : 0) +
        (preferredSide && preferredSide !== "right" ? (sameCluster ? 4 : 16) : 0),
      points: [srcPt, { x: right + pad, y: srcPt.y }, { x: right + pad, y: tgtPt.y }, tgtPt],
    },
  ];

  candidates.sort((a, b) => a.score - b.score || a.side.localeCompare(b.side));
  return candidates[0].points;
}

// ── Build LayoutResult from position map ──────────────────────────────────────

function buildResult(
  pos: Map<string, { x: number; y: number; layer: number }>,
  parsed: ParsedMermaidGraph,
  direction: string,
  routeStyle: RouteStyle = "smooth",
  routeContext?: RouteContext
): LayoutResult {
  const isVert = direction === "TB" || direction === "TD";

  // Normalize: shift so min x/y = PAD
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [, p] of pos) {
    minX = Math.min(minX, p.x - NODE_W / 2);
    minY = Math.min(minY, p.y - NODE_H / 2);
    maxX = Math.max(maxX, p.x + NODE_W / 2);
    maxY = Math.max(maxY, p.y + NODE_H / 2);
  }

  const offX = PAD - minX;
  const offY = PAD - minY;
  for (const [id, p] of pos) {
    pos.set(id, { x: p.x + offX, y: p.y + offY, layer: p.layer });
  }

  const vbW = maxX - minX + PAD * 2;
  const vbH = maxY - minY + PAD * 2;
  const center: Point = {
    x: (minX + maxX) / 2 + offX,
    y: (minY + maxY) / 2 + offY,
  };
  const ringSpacing = routeContext?.ringSpacing ?? Math.max(NODE_W, NODE_H) * 1.5;
  const nodeRingIndex = routeContext?.nodeRingIndex;

  // Build nodes
  const lnodes: LayoutNode[] = [];
  for (const [id, p] of pos) {
    const info = parsed.nodes.get(id);
    if (!info) continue;
    lnodes.push({
      id,
      label: info.label,
      shape: info.shape,
      x: p.x,
      y: p.y,
      w: NODE_W,
      h: NODE_H,
      layer: p.layer,
      style: parsed.nodeStyles.get(id) as LayoutNode["style"] || undefined,
    });
  }

  // Build edges with border-to-border routing
  const ledges: LayoutEdge[] = [];
  const edgeLaneUse = new Map<string, number>();
  for (let i = 0; i < parsed.edges.length; i++) {
    const e = parsed.edges[i];
    const sp = pos.get(e.source);
    const tp = pos.get(e.target);
    if (!sp || !tp) continue;

    const edgeId = `${e.source}-${e.target}-${i}`;

    // Direction of edge
    const dx = tp.x - sp.x;
    const dy = tp.y - sp.y;
    const angle = Math.atan2(dy, dx);

    // Start at source border, end at target border
    const srcPt = borderPoint(sp.x, sp.y, NODE_W / 2, NODE_H / 2, angle);
    const tgtPt = borderPoint(tp.x, tp.y, NODE_W / 2, NODE_H / 2, angle + Math.PI);

    const laneKey = `${e.source}→${e.target}`;
    const laneIndex = edgeLaneUse.get(laneKey) ?? 0;
    edgeLaneUse.set(laneKey, laneIndex + 1);
    const lane = [0, 1, -1, 2, -2][laneIndex % 5];
    const sourceClusterId = routeContext?.nodeClusterId?.get(e.source);
    const targetClusterId = routeContext?.nodeClusterId?.get(e.target);
    const sameCluster = !!sourceClusterId && sourceClusterId === targetClusterId;
    const sourceClusterCenter = routeContext?.nodeClusterCenter?.get(e.source);
    const targetClusterCenter = routeContext?.nodeClusterCenter?.get(e.target);
    let preferredSide: RouteSide | undefined;
    if (sourceClusterCenter && targetClusterCenter) {
      const cdx = targetClusterCenter.x - sourceClusterCenter.x;
      const cdy = targetClusterCenter.y - sourceClusterCenter.y;
      preferredSide = Math.abs(cdx) >= Math.abs(cdy)
        ? (cdx >= 0 ? "right" : "left")
        : (cdy >= 0 ? "bottom" : "top");
    }

    let points: Point[];
    if (routeStyle === "perpendicular") {
      points = perpendicularRoutePoints(srcPt, tgtPt, isVert, lane, { w: vbW, h: vbH });
    } else if (routeStyle === "orthogonal") {
      points = orthogonalRoutePoints(srcPt, tgtPt, isVert, lane);
    } else if (routeStyle === "concentric") {
      points = concentricRoutePoints(
        srcPt,
        tgtPt,
        center,
        nodeRingIndex?.get(e.source) ?? 0,
        nodeRingIndex?.get(e.target) ?? 0,
        ringSpacing,
        lane,
        sameCluster,
        preferredSide
      );
    } else if (isVert && Math.abs(dy) > NODE_H) {
      const midY = (srcPt.y + tgtPt.y) / 2;
      points = [
        srcPt,
        { x: srcPt.x, y: midY },
        { x: tgtPt.x, y: midY },
        tgtPt,
      ];
    } else {
      const midX = (srcPt.x + tgtPt.x) / 2;
      const midY = (srcPt.y + tgtPt.y) / 2;
      const perpX = -(tgtPt.y - srcPt.y) * 0.08;
      const perpY = (tgtPt.x - srcPt.x) * 0.08;
      points = [srcPt, { x: midX + perpX, y: midY + perpY }, tgtPt];
    }

    ledges.push({
      id: edgeId,
      source: e.source,
      target: e.target,
      label: e.label,
      edgeType: e.edgeType,
      sourcePos: srcPt,
      targetPos: tgtPt,
      points,
      routeStyle,
    });
  }

  return {
    nodes: lnodes,
    edges: ledges,
    groups: parsed.groups,
    viewBox: { x: 0, y: 0, w: Math.max(vbW, 200), h: Math.max(vbH, 150) },
  };
}

// ── Border intersection ──────────────────────────────────────────────────────

function borderPoint(cx: number, cy: number, hw: number, hh: number, angle: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  let t = Number.POSITIVE_INFINITY;
  if (Math.abs(cos) > 0.001) t = Math.min(t, hw / Math.abs(cos));
  if (Math.abs(sin) > 0.001) t = Math.min(t, hh / Math.abs(sin));
  if (!Number.isFinite(t)) t = 0;
  return { x: cx + cos * t, y: cy + sin * t };
}

// ── SVG rendering ────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nodeShapePath(n: LayoutNode): string {
  const { x, y, w, h, shape } = n;
  const rx = w / 2;
  const ry = h / 2;
  const r = Math.min(w, h) / 2;

  switch (shape) {
    case "rectangle":
      return `<rect x="${x - rx}" y="${y - ry}" width="${w}" height="${h}" rx="6" />`;

    case "rounded":
      return `<rect x="${x - rx}" y="${y - ry}" width="${w}" height="${h}" rx="16" ry="16" />`;

    case "diamond": {
      const pts = `${x},${y - ry} ${x + rx},${y} ${x},${y + ry} ${x - rx},${y}`;
      return `<polygon points="${pts}" />`;
    }

    case "circle":
      return `<circle cx="${x}" cy="${y}" r="${r}" />`;

    case "subroutine":
      return `<rect x="${x - rx}" y="${y - ry}" width="${w}" height="${h}" rx="6" /><rect x="${x - rx + 5}" y="${y - ry + 2}" width="${w - 10}" height="${h - 4}" rx="4" fill="none" />`;

    case "cylinder": {
      const eh = 10;
      return `<path d="M${x - rx},${y - ry + eh} L${x - rx},${y + ry - eh} A${rx},${eh} 0 0 0 ${x + rx},${y + ry - eh} L${x + rx},${y - ry + eh} A${rx},${eh} 0 0 1 ${x - rx},${y - ry + eh} Z" /><ellipse cx="${x}" cy="${y - ry}" rx="${rx}" ry="${eh}" />`;
    }

    case "stadium":
      return `<rect x="${x - rx}" y="${y - ry}" width="${w}" height="${h}" rx="${ry}" ry="${ry}" />`;

    case "parallelogram": {
      const skew = 18;
      const pts = `${x - rx + skew},${y - ry} ${x + rx + skew},${y - ry} ${x + rx - skew},${y + ry} ${x - rx - skew},${y + ry}`;
      return `<polygon points="${pts}" />`;
    }

    case "trapezoid": {
      const ti = 22;
      const pts = `${x - rx + ti},${y - ry} ${x + rx - ti},${y - ry} ${x + rx},${y + ry} ${x - rx},${y + ry}`;
      return `<polygon points="${pts}" />`;
    }

    case "asymmetric": {
      const notch = 16;
      const pts = `${x - rx + notch},${y - ry} ${x + rx},${y - ry} ${x + rx},${y + ry} ${x - rx + notch},${y + ry} ${x - rx},${y}`;
      return `<polygon points="${pts}" />`;
    }

    case "hexagon": {
      const hx = rx * 0.72;
      const hy = ry * 0.5;
      const pts = `${x - hx},${y - ry} ${x + hx},${y - ry} ${x + rx},${y} ${x + hx},${y + ry} ${x - hx},${y + ry} ${x - rx},${y}`;
      return `<polygon points="${pts}" />`;
    }

    default:
      return `<rect x="${x - rx}" y="${y - ry}" width="${w}" height="${h}" rx="6" />`;
  }
}

function applyShapeStyles(shapeStr: string, fill: string, stroke: string, sw: number): string {
  // Apply fill/stroke to each shape element
  return shapeStr
    .replace(/<rect /g, `<rect fill="${fill}" stroke="${stroke}" stroke-width="${sw}" `)
    .replace(/<polygon /g, `<polygon fill="${fill}" stroke="${stroke}" stroke-width="${sw}" `)
    .replace(/<path /g, `<path fill="${fill}" stroke="${stroke}" stroke-width="${sw}" `)
    .replace(/<circle /g, `<circle fill="${fill}" stroke="${stroke}" stroke-width="${sw}" `)
    .replace(/<ellipse /g, `<ellipse fill="${fill}" stroke="${stroke}" stroke-width="${sw}" `)
    // Fix inner rects for subroutine
    .replace(/fill="none"/g, `fill="none" stroke="${stroke}" stroke-width="${Math.max(0.8, sw * 0.5)}"`);
}

function edgePath(points: Point[], routeStyle: RouteStyle): string {
  const clean = dedupePoints(points);
  if (clean.length < 2) return "";
  if (routeStyle !== "smooth") {
    return clean.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  }
  const d = line<Point>().curve(curveBasis);
  return d(clean) || "";
}

// ── Full SVG render ──────────────────────────────────────────────────────────

function renderSVG(result: LayoutResult, theme: string): string {
  const { nodes, edges, groups, viewBox } = result;
  const isDark = theme === "dark" || theme === "observatory" || theme === "dracula" || theme === "nord";

  const nodeFill = isDark ? "#1e293b" : "#ffffff";
  const nodeStroke = isDark ? "#38bdf8" : "#3b82f6";
  const edgeColor = isDark ? "#0ea5e9" : "#64748b";
  const textColor = isDark ? "#e2e8f0" : "#0f172a";
  const labelBg = isDark ? "#0f172a" : "#f1f5f9";
  const bgFill = isDark ? "#0d1117" : "#fafbfc";
  const grpFill = isDark ? "rgba(56,189,248,0.04)" : "rgba(59,130,246,0.04)";
  const grpStroke = isDark ? "rgba(56,189,248,0.15)" : "rgba(59,130,246,0.15)";

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}" width="${viewBox.w}" height="${viewBox.h}" font-family="'JetBrains Mono', 'Fira Code', 'Inter', monospace">`;

  // Background
  svg += `<rect x="${viewBox.x}" y="${viewBox.y}" width="${viewBox.w}" height="${viewBox.h}" fill="${bgFill}" />`;

  // Arrow markers
  svg += `<defs>
    <marker id="ah" viewBox="0 0 10 7" refX="9" refY="3.5" markerWidth="7" markerHeight="5" orient="auto">
      <path d="M0,0 L10,3.5 L0,7 Z" fill="${edgeColor}" />
    </marker>
    <marker id="ah-thick" viewBox="0 0 10 7" refX="9" refY="3.5" markerWidth="9" markerHeight="7" orient="auto">
      <path d="M0,0 L10,3.5 L0,7 Z" fill="${edgeColor}" />
    </marker>
    <filter id="ns" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="1" stdDeviation="3" flood-color="#000" flood-opacity="0.25" />
    </filter>
  </defs>`;

  // Groups
  for (const g of groups) {
    const kids = nodes.filter((n) => g.childIds.includes(n.id));
    if (kids.length < 2) continue;
    const gx = Math.min(...kids.map((n) => n.x - n.w / 2)) - 18;
    const gy = Math.min(...kids.map((n) => n.y - n.h / 2)) - 14;
    const gw = Math.max(...kids.map((n) => n.x + n.w / 2)) - gx + 18;
    const gh = Math.max(...kids.map((n) => n.y + n.h / 2)) - gy + 14;
    svg += `<rect x="${gx}" y="${gy}" width="${gw}" height="${gh}" fill="${grpFill}" stroke="${grpStroke}" stroke-width="1" rx="8" stroke-dasharray="6,3" />`;
    svg += `<text x="${gx + 8}" y="${gy - 4}" fill="${isDark ? "#6b7280" : "#94a3b8"}" font-size="10" font-style="italic">${esc(g.label)}</text>`;
  }

  // Edges
  for (const e of edges) {
    const pts = e.points;
    if (!pts || pts.length < 2) continue;

    const pathD = edgePath(pts, e.routeStyle ?? "smooth");
    const sw = e.edgeType === "thick" ? 2.5 : 1.5;
    const dash = e.edgeType === "dotted" ? ' stroke-dasharray="5,4"' : "";
    const marker = e.edgeType === "thick" ? "url(#ah-thick)" : "url(#ah)";

    svg += `<path d="${pathD}" fill="none" stroke="${edgeColor}" stroke-width="${sw}"${dash} marker-end="${marker}" />`;

    if (e.label) {
      const mid = pts[Math.floor(pts.length / 2)];
      const tw = Math.max(e.label.length * 6.5 + 14, 32);
      svg += `<rect x="${mid.x - tw / 2}" y="${mid.y - 8}" width="${tw}" height="14" fill="${labelBg}" rx="3" opacity="0.92" />`;
      svg += `<text x="${mid.x}" y="${mid.y + 3}" fill="${textColor}" font-size="10" text-anchor="middle" pointer-events="none">${esc(e.label)}</text>`;
    }
  }

  // Nodes
  for (const n of nodes) {
    const s = n.style || {};
    const fill = (s.fill as string) || nodeFill;
    const stroke = (s.stroke as string) || nodeStroke;
    const sw = (s.strokeWidth as number) || 1.5;
    const fc = (s.fontColor as string) || textColor;
    const fs = (s.fontSize as number) || 12;

    svg += `<g filter="url(#ns)">`;
    svg += applyShapeStyles(nodeShapePath(n), fill, stroke, sw);
    svg += "</g>";

    // Text
    const lines = n.label.split(/<br\s*\/?>|\n/).filter(Boolean);
    if (lines.length <= 1) {
      svg += `<text x="${n.x}" y="${n.y + fs * 0.35}" fill="${fc}" font-size="${fs}" text-anchor="middle" dominant-baseline="central" pointer-events="none">${esc(n.label)}</text>`;
    } else {
      const lh = fs * 1.3;
      const totalH = lines.length * lh;
      const sy = n.y - totalH / 2 + lh / 2;
      for (let i = 0; i < lines.length; i++) {
        svg += `<text x="${n.x}" y="${sy + i * lh + fs * 0.35}" fill="${fc}" font-size="${fs}" text-anchor="middle" pointer-events="none">${esc(lines[i])}</text>`;
      }
    }
  }

  svg += "</svg>";
  return svg;
}

type MermaidFlowchartRenderer = NonNullable<MermaidConfig["flowchart"]>["defaultRenderer"];
type MermaidFlowchartCurve = NonNullable<MermaidConfig["flowchart"]>["curve"];

interface MermaidRenderOutput {
  svg: string;
  bindFunctions?: (element: Element) => void;
}

let mermaidModulePromise: Promise<typeof import("mermaid")> | null = null;
let mermaidRenderTail: Promise<void> = Promise.resolve();

function loadMermaidModule() {
  if (!mermaidModulePromise) {
    mermaidModulePromise = import("mermaid");
  }
  return mermaidModulePromise;
}

function runMermaidExclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = mermaidRenderTail.then(task, task);
  mermaidRenderTail = run.then(() => undefined, () => undefined);
  return run;
}

function ensureMermaidMeasurementSupport() {
  const globalSvgElement = globalThis.SVGElement as unknown as { prototype?: Record<string, unknown> } | undefined;
  const globalGraphicsElement = globalThis.SVGGraphicsElement as unknown as { prototype?: Record<string, unknown> } | undefined;
  const globalTextContentElement = globalThis.SVGTextContentElement as unknown as { prototype?: Record<string, unknown> } | undefined;

  const getBBoxFallback = function getBBoxFallback(this: Element) {
    const text = (this.textContent ?? "").replace(/\s+/g, " ").trim();
    const width = Math.max(24, text.length * 8);
    const height = 16;
    return {
      x: 0,
      y: 0,
      width,
      height,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
    };
  };

  const getComputedTextLengthFallback = function getComputedTextLengthFallback(this: Element) {
    const text = (this.textContent ?? "").replace(/\s+/g, " ").trim();
    return Math.max(24, text.length * 8);
  };

  const svgPrototypes = [globalSvgElement?.prototype, globalGraphicsElement?.prototype].filter(Boolean) as Array<Record<string, unknown>>;
  for (const proto of svgPrototypes) {
    if (typeof proto.getBBox !== "function") {
      proto.getBBox = getBBoxFallback;
    }
  }

  const textPrototype = globalTextContentElement?.prototype ?? globalSvgElement?.prototype;
  if (textPrototype && typeof textPrototype.getComputedTextLength !== "function") {
    textPrototype.getComputedTextLength = getComputedTextLengthFallback;
  }
}

function flowchartRendererForAlgorithm(algorithm: LayoutAlgorithm): MermaidFlowchartRenderer {
  switch (algorithm) {
    case "orthogonal":
    case "concentric":
    case "elk-layered":
    case "elk-mrtree":
    case "elk-radial":
    case "elk-force":
      return "elk";
    default:
      return "dagre-wrapper";
  }
}

function flowchartCurveForAlgorithm(algorithm: LayoutAlgorithm): MermaidFlowchartCurve {
  switch (algorithm) {
    case "orthogonal":
    case "concentric":
    case "elk-layered":
    case "elk-mrtree":
    case "elk-radial":
    case "elk-force":
    case "bus":
      return "step";
    case "force":
    case "circular":
      return "basis";
    default:
      return "basis";
  }
}

function flowchartSpacingForAlgorithm(algorithm: LayoutAlgorithm): { nodeSpacing: number; rankSpacing: number } {
  switch (algorithm) {
    case "orthogonal":
      return { nodeSpacing: 80, rankSpacing: 120 };
    case "concentric":
      return { nodeSpacing: 90, rankSpacing: 130 };
    case "bus":
      return { nodeSpacing: 70, rankSpacing: 120 };
    case "force":
      return { nodeSpacing: 90, rankSpacing: 90 };
    case "tree":
      return { nodeSpacing: 48, rankSpacing: 84 };
    case "elk-layered":
    case "elk-mrtree":
    case "elk-radial":
    case "elk-force":
      return { nodeSpacing: 72, rankSpacing: 108 };
    default:
      return { nodeSpacing: 56, rankSpacing: 90 };
  }
}

interface FlowchartStats {
  nodeCount: number;
  edgeCount: number;
  groupCount: number;
  maxGroupSize: number;
  averageLabelLength: number;
  maxLabelLength: number;
  density: number;
}

function summarizeFlowchart(parsed: ParsedMermaidGraph): FlowchartStats {
  const labels = [...parsed.nodes.values()].map((node) => node.label.trim());
  const labelLengths = labels.map((label) => label.length);
  const groupSizes = parsed.groups.map((group) => group.childIds.length);

  return {
    nodeCount: parsed.nodes.size,
    edgeCount: parsed.edges.length,
    groupCount: parsed.groups.length,
    maxGroupSize: groupSizes.length > 0 ? Math.max(...groupSizes) : 0,
    averageLabelLength: labelLengths.length > 0
      ? labelLengths.reduce((sum, length) => sum + length, 0) / labelLengths.length
      : 0,
    maxLabelLength: labelLengths.length > 0 ? Math.max(...labelLengths) : 0,
    density: parsed.nodes.size > 0 ? parsed.edges.length / parsed.nodes.size : 0,
  };
}

function shouldCompactFlowchart(stats: FlowchartStats): boolean {
  return (
    stats.nodeCount >= 12 &&
    stats.groupCount >= 2 &&
    stats.edgeCount >= stats.nodeCount &&
    (stats.maxGroupSize >= 4 || stats.maxLabelLength >= 24 || stats.averageLabelLength >= 16)
  );
}

function rewriteSubgraphDirections(code: string, direction: string): string {
  return code.replace(/(^|\n)(\s*direction\s+)(TB|TD|BT|LR|RL)\b/gi, (_match, prefix: string, directive: string) => {
    return `${prefix}${directive}${direction}`;
  });
}

function themeVariablesForGraphique(theme: GraphiqueTheme): Record<string, string> {
  const darkTheme = theme === "dark" || theme === "observatory" || theme === "dracula" || theme === "nord";

  if (darkTheme) {
    return {
      background: "#0d1117",
      mainBkg: "#111827",
      secondBkg: "#0f172a",
      tertiaryBkg: "#111827",
      primaryColor: "#1e293b",
      secondaryColor: "#0f172a",
      tertiaryColor: "#020617",
      primaryTextColor: "#e2e8f0",
      secondaryTextColor: "#cbd5e1",
      tertiaryTextColor: "#94a3b8",
      primaryBorderColor: "#38bdf8",
      secondaryBorderColor: "#1d4ed8",
      tertiaryBorderColor: "#0f766e",
      lineColor: "#64748b",
      textColor: "#e2e8f0",
    };
  }

  if (theme === "forest") {
    return {
      background: "#f0fdf4",
      mainBkg: "#ecfdf5",
      secondBkg: "#dcfce7",
      tertiaryBkg: "#bbf7d0",
      primaryColor: "#ecfdf5",
      secondaryColor: "#dcfce7",
      tertiaryColor: "#bbf7d0",
      primaryTextColor: "#052e16",
      secondaryTextColor: "#14532d",
      tertiaryTextColor: "#166534",
      primaryBorderColor: "#16a34a",
      secondaryBorderColor: "#15803d",
      tertiaryBorderColor: "#166534",
      lineColor: "#15803d",
      textColor: "#052e16",
    };
  }

  if (theme === "neutral") {
    return {
      background: "#fafafa",
      mainBkg: "#ffffff",
      secondBkg: "#f3f4f6",
      tertiaryBkg: "#e5e7eb",
      primaryColor: "#ffffff",
      secondaryColor: "#f3f4f6",
      tertiaryColor: "#e5e7eb",
      primaryTextColor: "#111827",
      secondaryTextColor: "#374151",
      tertiaryTextColor: "#6b7280",
      primaryBorderColor: "#6b7280",
      secondaryBorderColor: "#9ca3af",
      tertiaryBorderColor: "#d1d5db",
      lineColor: "#6b7280",
      textColor: "#111827",
    };
  }

  return {
    background: "#fafbfc",
    mainBkg: "#ffffff",
    secondBkg: "#f8fafc",
    tertiaryBkg: "#e2e8f0",
    primaryColor: "#ffffff",
    secondaryColor: "#f8fafc",
    tertiaryColor: "#e2e8f0",
    primaryTextColor: "#0f172a",
    secondaryTextColor: "#334155",
    tertiaryTextColor: "#475569",
    primaryBorderColor: "#3b82f6",
    secondaryBorderColor: "#64748b",
    tertiaryBorderColor: "#94a3b8",
    lineColor: "#64748b",
    textColor: "#0f172a",
  };
}

function buildMermaidConfig(
  algorithm: LayoutAlgorithm,
  theme: GraphiqueTheme,
  diagramType: ReturnType<typeof detectDiagramType>,
  compact = false
): MermaidConfig {
  const flowchart = diagramType === "flowchart"
    ? {
        useMaxWidth: false,
        htmlLabels: false,
        defaultRenderer: compact ? "elk" : flowchartRendererForAlgorithm(algorithm),
        curve: compact ? "step" : flowchartCurveForAlgorithm(algorithm),
        ...(compact ? { nodeSpacing: 42, rankSpacing: 72 } : flowchartSpacingForAlgorithm(algorithm)),
        ...(compact
          ? {
              diagramPadding: 4,
              subGraphTitleMargin: { top: 4, bottom: 4 },
              padding: 4,
              wrappingWidth: 160,
            }
          : {}),
        inheritDir: true,
      }
    : undefined;

  return {
    startOnLoad: false,
    securityLevel: "strict",
    deterministicIds: true,
    deterministicIDSeed: "graphique",
    suppressErrorRendering: true,
    htmlLabels: false,
    theme: "base",
    themeVariables: themeVariablesForGraphique(theme),
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Inter', monospace",
    fontSize: compact ? 18 : 16,
    wrap: compact,
    markdownAutoWrap: compact,
    ...(flowchart ? { flowchart } : {}),
    ...(compact
      ? {
          elk: {
            mergeEdges: true,
            nodePlacementStrategy: "BRANDES_KOEPF",
            cycleBreakingStrategy: "GREEDY_MODEL_ORDER",
            forceNodeModelOrder: true,
            considerModelOrder: "PREFER_NODES",
          },
        }
      : {}),
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function renderMermaidToSVG(
  code: string,
  algorithm: LayoutAlgorithm,
  direction: string,
  theme: GraphiqueTheme
): Promise<{ svg: string; nodeCount: number; edgeCount: number; errors: string[]; bindFunctions?: (element: Element) => void }> {
  return runMermaidExclusive(async () => {
    const diagramType = detectDiagramType(code);
    const parsed = diagramType === "flowchart" ? parseMermaid(code) : null;
    const nodeCount = parsed?.nodes.size ?? 0;
    const edgeCount = parsed?.edges.length ?? 0;
    const compactFlowchart = parsed ? shouldCompactFlowchart(summarizeFlowchart(parsed)) : false;
    const outerDirection = diagramType === "flowchart" && compactFlowchart ? "TB" : direction;
    const innerDirection = diagramType === "flowchart" && compactFlowchart ? "LR" : null;
    let source = diagramType === "flowchart"
      ? injectLayoutForAlgorithm(code, algorithm, outerDirection)
      : code.trim();
    if (diagramType === "flowchart" && compactFlowchart && innerDirection) {
      source = rewriteSubgraphDirections(source, innerDirection);
    }

    if (
      diagramType === "flowchart" &&
      parsed &&
      nodeCount === 0 &&
      edgeCount === 0 &&
      parsed.groups.length === 0 &&
      parsed.parseErrors.length === 0
    ) {
      return { svg: "", nodeCount: 0, edgeCount: 0, errors: [] };
    }

    // --- GRAPHIQUE CUSTOM RENDERER INTERCEPT ---
    // If it's a flowchart and we want a custom layout, use our own engine
    const useCustomRenderer =
      diagramType === "flowchart" &&
      parsed &&
      [
        "hierarchical",
        "force",
        "tree",
        "circular",
        "orthogonal",
        "concentric",
        "bus",
      ].includes(algorithm);

    if (useCustomRenderer && parsed) {
      try {
        const layoutResult = computeLayout(parsed, algorithm, outerDirection);
        const svg = renderSVG(layoutResult, theme);
        return {
          svg,
          nodeCount,
          edgeCount,
          errors: [],
        };
      } catch (err) {
        console.error("Custom layout failed, falling back to Mermaid:", err);
      }
    }

    try {
      const mermaidModule = await loadMermaidModule();
      const mermaid = mermaidModule.default;
      ensureMermaidMeasurementSupport();
      mermaid.mermaidAPI.reset();
      mermaid.initialize(buildMermaidConfig(algorithm, theme, diagramType, compactFlowchart));

      const renderId = `graphique-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const result = await mermaid.render(renderId, source);
      const renderOutput: MermaidRenderOutput = {
        svg: result.svg,
        bindFunctions: result.bindFunctions,
      };

      return {
        svg: renderOutput.svg,
        nodeCount,
        edgeCount,
        errors: [],
        bindFunctions: renderOutput.bindFunctions,
      };
    } catch (err) {
      return {
        svg: "",
        nodeCount,
        edgeCount,
        errors: [err instanceof Error ? err.message : String(err)],
      };
    }
  });
}
