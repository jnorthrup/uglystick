# Core Graph Model — Feature Spec

## Overview
The `IGraph` interface is the unified in-memory representation of any diagram. All parsers (Mermaid, DOT) produce an `IGraph`; all renderers and exporters consume it.

## Goals
- Single source of truth for graph state
- Supports nodes, edges, groups/subgraphs, metadata
- Bidirectional serialization: Mermaid ↔ IGraph ↔ DOT ↔ JSON

## Data Model / Schema
```typescript
interface INode {
  id: string;
  label: string;
  shape: 'rectangle' | 'rounded' | 'diamond' | 'circle' | 'ellipse' | 'hexagon' | 'parallelogram' | 'cylinder' | 'stadium';
  x: number; y: number; width: number; height: number;
  style: NodeStyle;
  groupId?: string;
  ports?: IPort[];
  metadata: Record<string, unknown>;
}
interface IEdge {
  id: string; source: string; target: string;
  label?: string;
  type: 'arrow' | 'line' | 'dotted' | 'thick' | 'invisible';
  arrowStart?: ArrowType; arrowEnd?: ArrowType;
  waypoints?: Point[];
  style: EdgeStyle;
  metadata: Record<string, unknown>;
}
interface IGroup { id: string; label: string; childIds: string[]; style: GroupStyle; }
interface IGraph {
  id: string; title?: string;
  nodes: Map<string, INode>;
  edges: Map<string, IEdge>;
  groups: Map<string, IGroup>;
  layoutData: ILayoutData;
  styleData: IStyleData;
  toMermaid(): string;
  toDOT(): string;
  toJSON(): GraphJSON;
}
```

## Functional Requirements
- Parse Mermaid flowchart/sequence/class/gitgraph/er/mindmap syntax
- Parse Graphviz DOT (digraph, graph, subgraph)
- Round-trip serialization (parse → serialize) preserves semantic meaning
- Immutable update pattern (produce new IGraph from transforms)
- Node/edge add/remove/update operations
- Group (subgraph) support

## Acceptance Criteria
- [ ] Mermaid flowchart TD parsed correctly into IGraph nodes/edges
- [ ] DOT digraph parsed into equivalent IGraph
- [ ] IGraph.toMermaid() produces valid Mermaid that re-parses to equivalent graph
- [ ] Groups/subgraphs round-trip correctly

## Status
planned