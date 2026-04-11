// ─────────────────────────────────────────────────────────────────────────────
// GRAPHIQUE 2026 — Mermaid Flowchart Parser
// Parses Mermaid flowchart syntax into structured graph data.
// ─────────────────────────────────────────────────────────────────────────────

import type { NodeShape, EdgeType, ArrowType, NodeStyle } from "./types";

// ── Shape detection ──────────────────────────────────────────────────────────

const SHAPE_MAP: Array<{ re: RegExp; shape: NodeShape }> = [
  { re: /^\(\((.+?)\)\)$/, shape: "circle" },           // ((text))
  { re: /^\[\[(.+?)\]\]$/, shape: "subroutine" },       // [[text]]
  { re: /^\[\((.+?)\)\]$/, shape: "cylinder" },         // [(text)]
  { re: /^\(\[(.+?)\]\)$/, shape: "stadium" },          // ([text])
  { re: /^\{\{(.+?)\}\}$/, shape: "hexagon" },          // {{text}}
  { re: /^\{(.+?)\}$/, shape: "diamond" },              // {text}
  { re: /^\[\/(.+?)\/\]$/, shape: "parallelogram" },    // [/text/]
  { re: /^\[\\(.+?)\\\]$/, shape: "trapezoid" },        // [\text\]
  { re: /^\/(.+?)\/$/, shape: "parallelogram" },        // /text/
  { re: /^\\(.+?)\\$/, shape: "trapezoid" },            // \text\
  { re: /^\/(.+?)\\$/, shape: "trapezoid" },            // /text\
  { re: /^\\(.+?)\/$/, shape: "trapezoid" },            // \text/
  { re: /^>(.+?)\]$/, shape: "asymmetric" },            // >text]
  { re: /^\((.+?)\)$/, shape: "rounded" },              // (text)
  { re: /^\[(.+?)\]$/, shape: "rectangle" },            // [text]
];

function detectShape(shapePart: string): { shape: NodeShape; label: string } {
  for (const { re, shape } of SHAPE_MAP) {
    const m = shapePart.match(re);
    if (m) return { shape, label: m[1] || shapePart };
  }
  return { shape: "rectangle", label: shapePart };
}

// ── Parse a node reference from source code ──────────────────────────────────

interface NodeRef {
  id: string;
  label: string;
  shape: NodeShape;
}

function parseNodeRef(raw: string): NodeRef {
  const trimmed = raw.trim();

  // Match: ID followed by shape syntax: A[...], A{...}, A((...)), etc.
  const m = trimmed.match(/^([A-Za-z0-9_\u4e00-\u9fff]+)\s*(.+)$/);
  if (m) {
    const id = m[1];
    const info = detectShape(m[2]);
    return { id, label: info.label, shape: info.shape };
  }

  // Bare ID with no shape
  const bare = trimmed.match(/^([A-Za-z0-9_\u4e00-\u9fff]+)$/);
  if (bare) return { id: bare[1], label: bare[1], shape: "rectangle" };

  return { id: trimmed, label: trimmed, shape: "rectangle" };
}

// ── Edge parsing ─────────────────────────────────────────────────────────────

export interface ParsedEdge {
  source: string;
  target: string;
  label?: string;
  edgeType: EdgeType;
  arrowEnd: ArrowType;
}

function parseEdge(line: string): ParsedEdge | null {
  // Thick arrow with label: ==>|text| or == text ==>
  let m = line.match(/^(.+?)\s*==>\s*\|([^|]*)\|\s*(.+)$/);
  if (m) return { source: m[1].trim(), target: m[3].trim(), label: m[2].trim(), edgeType: "thick", arrowEnd: "arrow" };
  m = line.match(/^(.+?)\s*==\s*\|([^|]*)\|\s*==>\s*(.+)$/);
  if (m) return { source: m[1].trim(), target: m[3].trim(), label: m[2].trim(), edgeType: "thick", arrowEnd: "arrow" };

  // Thick arrow: ==>
  m = line.match(/^(.+?)\s*==>\s*(.+)$/);
  if (m) return { source: m[1].trim(), target: m[2].trim(), edgeType: "thick", arrowEnd: "arrow" };

  // Dotted arrow with label: -.->|text| or -. text .->
  m = line.match(/^(.+?)\s*-\.\s*->\s*\|([^|]*)\|\s*(.+)$/);
  if (m) return { source: m[1].trim(), target: m[3].trim(), label: m[2].trim(), edgeType: "dotted", arrowEnd: "arrow" };
  m = line.match(/^(.+?)\s*-\.\s*(.*?)\s*\.->\s*(.+)$/);
  if (m) return { source: m[1].trim(), target: m[3].trim(), label: m[2]?.trim() || undefined, edgeType: "dotted", arrowEnd: "arrow" };

  // Dotted arrow: -.->
  m = line.match(/^(.+?)\s*-\.\s*->\s*(.+)$/);
  if (m) return { source: m[1].trim(), target: m[2].trim(), edgeType: "dotted", arrowEnd: "arrow" };

  // Labeled arrow: -->|text| target
  m = line.match(/^(.+?)\s*-->\s*\|([^|]*)\|\s*(.+)$/);
  if (m) return { source: m[1].trim(), target: m[3].trim(), label: m[2].trim(), edgeType: "arrow", arrowEnd: "arrow" };

  // Labeled arrow: --|text|--> target
  m = line.match(/^(.+?)\s*--\s*\|([^|]*)\|\s*-->\s*(.+)$/);
  if (m) return { source: m[1].trim(), target: m[3].trim(), label: m[2].trim(), edgeType: "arrow", arrowEnd: "arrow" };

  // Regular arrow: -->
  m = line.match(/^(.+?)\s*-->\s*(.+)$/);
  if (m) return { source: m[1].trim(), target: m[2].trim(), edgeType: "arrow", arrowEnd: "arrow" };

  // Line: ---
  m = line.match(/^(.+?)\s*---\s*(.+)$/);
  if (m) return { source: m[1].trim(), target: m[2].trim(), edgeType: "line", arrowEnd: "none" };

  return null;
}

// ── Style parsing ────────────────────────────────────────────────────────────

function parseStyleProps(value: string): NodeStyle {
  const result: NodeStyle = {};
  for (const part of value.split(",")) {
    const kv = part.split(":");
    if (kv.length >= 2) {
      const k = kv[0].trim();
      const v = kv.slice(1).join(":").trim();
      if (k === "fill") result.fill = v;
      else if (k === "stroke") result.stroke = v;
      else if (k === "stroke-width") result.strokeWidth = Number.parseFloat(v);
      else if (k === "color") result.fontColor = v;
      else if (k === "font-size") result.fontSize = Number.parseFloat(v);
      else if (k === "opacity") result.opacity = Number.parseFloat(v);
    }
  }
  return result;
}

// ── Parsed result ────────────────────────────────────────────────────────────

export interface ParsedMermaidGraph {
  nodes: Map<string, { label: string; shape: NodeShape }>;
  edges: ParsedEdge[];
  groups: { id: string; label: string; childIds: string[] }[];
  nodeStyles: Map<string, NodeStyle>;
  classDefs: Map<string, NodeStyle>;
  direction: "TD" | "TB" | "LR" | "RL";
  parseErrors: string[];
}

// ── Main parser ──────────────────────────────────────────────────────────────

export function parseMermaid(code: string): ParsedMermaidGraph {
  const nodes = new Map<string, { label: string; shape: NodeShape }>();
  const edges: ParsedEdge[] = [];
  const groups: ParsedMermaidGraph["groups"] = [];
  const nodeStyles = new Map<string, NodeStyle>();
  const classDefs = new Map<string, NodeStyle>();
  const parseErrors: string[] = [];
  let direction: "TD" | "TB" | "LR" | "RL" = "TD";
  const activeSubgraphs: ParsedMermaidGraph["groups"] = [];

  const ensureNode = (id: string, label: string, shape: NodeShape) => {
    if (!nodes.has(id)) {
      nodes.set(id, { label: label || id, shape });
    }
    if (activeSubgraphs.length > 0) {
      for (const g of activeSubgraphs) {
        if (!g.childIds.includes(id)) g.childIds.push(id);
      }
    }
  };

  for (const [lineIdx, raw] of code.split("\n").entries()) {
    const line = raw.trim();
    if (!line || line.startsWith("%%")) continue;

    // Header
    const header = line.match(/^(?:graph|flowchart(?:-elk)?)\s+(TD|TB|LR|RL|BT)$/i);
    if (header) {
      const d = header[1].toUpperCase();
      direction = d === "BT" ? "TB" : d as typeof direction;
      continue;
    }

    // style directive
    const styleM = line.match(/^style\s+(\S+)\s+(.+)$/i);
    if (styleM) {
      nodeStyles.set(styleM[1], parseStyleProps(styleM[2]));
      continue;
    }

    // classDef
    const classDefM = line.match(/^classDef\s+(\S+)\s+(.+)$/i);
    if (classDefM) {
      classDefs.set(classDefM[1], parseStyleProps(classDefM[2]));
      continue;
    }

    // class assignment
    const classM = line.match(/^class\s+(\S+)\s+(\S+)$/i);
    if (classM) {
      const ids = classM[1].split(",").map((s) => s.trim());
      const style = classDefs.get(classM[2]);
      if (style) {
        for (const id of ids) {
          const existing = nodeStyles.get(id);
          nodeStyles.set(id, existing ? { ...existing, ...style } : { ...style });
        }
      }
      continue;
    }

    // subgraph
    const subM = line.match(/^subgraph\s+([A-Za-z0-9_]+)\s*(.*)$/i);
    if (subM) {
      const id = subM[1];
      const label = subM[2]?.replace(/[\[\]]/g, "").trim() || id;
      const g = { id, label, childIds: [] as string[] };
      groups.push(g);
      activeSubgraphs.push(g);
      continue;
    }

    if (line === "end" && activeSubgraphs.length > 0) {
      activeSubgraphs.pop();
      continue;
    }

    // Edge
    const edge = parseEdge(line);
    if (edge) {
      const src = parseNodeRef(edge.source);
      const tgt = parseNodeRef(edge.target);
      edges.push({ source: src.id, target: tgt.id, label: edge.label, edgeType: edge.edgeType, arrowEnd: edge.arrowEnd });
      ensureNode(src.id, src.label, src.shape);
      ensureNode(tgt.id, tgt.label, tgt.shape);
      continue;
    }

    // Standalone node: A[Label]
    const nodeM = line.match(/^([A-Za-z0-9_\u4e00-\u9fff]+)\s*(.+)$/);
    if (nodeM) {
      const id = nodeM[1];
      const info = detectShape(nodeM[2]);
      ensureNode(id, info.label, info.shape);
      continue;
    }

    // Bare ID
    const bareM = line.match(/^([A-Za-z0-9_\u4e00-\u9fff]+)$/);
    if (bareM) {
      ensureNode(bareM[1], bareM[1], "rectangle");
      continue;
    }

    parseErrors.push(`Line ${lineIdx + 1}: unrecognized syntax`);
  }

  return { nodes, edges, groups, nodeStyles, classDefs, direction, parseErrors };
}
