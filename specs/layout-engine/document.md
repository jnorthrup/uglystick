# Layout Engine — Feature Spec

## Overview
Pluggable layout algorithm registry with multiple algorithms. Computes node positions and edge waypoints; writes results back into IGraph layout data.

## Algorithms
| Algorithm | Implementation | Notes |
|-----------|---------------|-------|
| Hierarchical (Sugiyama) | ELK.js layered | Primary for flowcharts |
| Force-Directed | D3-force | Network/organic graphs |
| Tree (Reingold-Tilford) | D3-tree | Org charts |
| Circular/Radial | Custom + D3-cluster | Dependency wheels |
| Orthogonal | ELK.js orthogonal | Circuit diagrams |
| Bus Routing | ELK.js | Dense edge bundling |

## Functional Requirements
- All algorithms implement `ILayoutAlgorithm` interface
- Incremental layout: only re-layout affected subgraph
- Smooth animated transition (300ms) between layouts
- Export computed positions back to IGraph
- Constraint support: fixed-position nodes, alignment groups

## Acceptance Criteria
- [ ] Hierarchical layout correctly layers a 20-node flowchart
- [ ] Force layout runs in < 100ms for 200 nodes
- [ ] Layout transition animates smoothly at 60fps
- [ ] Switching algorithms preserves selection state

## Status
planned