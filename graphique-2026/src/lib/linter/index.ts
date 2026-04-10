// ─────────────────────────────────────────────────────────────────────────────
// GRAPHIQUE 2026 — Linter & Diagnostics Engine
// ─────────────────────────────────────────────────────────────────────────────

import type { IDiagnostic } from "../graph/types";

interface LintResult {
  diagnostics: IDiagnostic[];
  valid: boolean;
}

/**
 * Basic Mermaid syntax linter — catches common errors before rendering.
 */
export function lintMermaid(code: string): LintResult {
  const diagnostics: IDiagnostic[] = [];
  const lines = code.split("\n");

  const DIAGRAM_HEADERS = [
    /^graph\s+(TD|TB|LR|RL|BT)/i,
    /^flowchart\s+(TD|TB|LR|RL|BT)/i,
    /^sequenceDiagram/i,
    /^classDiagram/i,
    /^stateDiagram(-v2)?/i,
    /^erDiagram/i,
    /^gantt/i,
    /^pie/i,
    /^mindmap/i,
    /^gitGraph/i,
    /^xychart-beta/i,
    /^block-beta/i,
    /^%%\{/,
  ];

  // Check: first non-empty line must be a valid diagram header
  const firstNonEmpty = lines.findIndex((l) => l.trim().length > 0);
  if (firstNonEmpty === -1) {
    diagnostics.push({
      severity: "error",
      code: "GQ001",
      message: "Empty diagram — please add diagram content",
      startLine: 0,
      endLine: 0,
      startCol: 0,
      endCol: 0,
    });
    return { diagnostics, valid: false };
  }

  // Skip %%{init}%% block
  let headerLine = firstNonEmpty;
  if (lines[firstNonEmpty]?.trim().startsWith("%%{")) {
    // Find closing
    for (let i = firstNonEmpty; i < lines.length; i++) {
      if (lines[i].includes("}%%")) {
        headerLine = i + 1;
        break;
      }
    }
  }

  const headerText = lines[headerLine]?.trim() || "";
  const isValidHeader = DIAGRAM_HEADERS.some((re) => re.test(headerText));

  if (!isValidHeader && headerText.length > 0) {
    diagnostics.push({
      severity: "error",
      code: "GQ002",
      message: `Unknown diagram type: "${headerText}". Expected: graph, flowchart, sequenceDiagram, classDiagram, etc.`,
      startLine: headerLine,
      endLine: headerLine,
      startCol: 0,
      endCol: headerText.length,
      quickFix: `graph TD\n    A[Start] --> B[End]`,
    });
  }

  // Per-line checks
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (trimmed.startsWith("%%") || trimmed.length === 0) continue;

    // Unmatched brackets check (rough heuristic)
    const opens = (trimmed.match(/\[/g) || []).length;
    const closes = (trimmed.match(/\]/g) || []).length;
    if (opens !== closes && !trimmed.includes("-->") && !trimmed.includes("---")) {
      diagnostics.push({
        severity: "warning",
        code: "GQ010",
        message: `Possible unmatched brackets on this line (${opens} '[' vs ${closes} ']')`,
        startLine: i,
        endLine: i,
        startCol: 0,
        endCol: trimmed.length,
      });
    }

    // Check for tabs (Mermaid prefers spaces)
    if (line.includes("\t")) {
      diagnostics.push({
        severity: "hint",
        code: "GQ020",
        message: "Prefer spaces over tabs for Mermaid indentation",
        startLine: i,
        endLine: i,
        startCol: 0,
        endCol: line.indexOf("\t") + 1,
        quickFix: line.replace(/\t/g, "    "),
      });
    }

    // Very long lines
    if (line.length > 200) {
      diagnostics.push({
        severity: "info",
        code: "GQ030",
        message: `Line is ${line.length} characters — consider breaking it up for readability`,
        startLine: i,
        endLine: i,
        startCol: 200,
        endCol: line.length,
      });
    }
  }

  return {
    diagnostics,
    valid: !diagnostics.some((d) => d.severity === "error"),
  };
}

/**
 * Basic DOT syntax linter
 */
export function lintDOT(code: string): LintResult {
  const diagnostics: IDiagnostic[] = [];
  const trimmed = code.trim();

  if (!trimmed.startsWith("digraph") && !trimmed.startsWith("graph")) {
    diagnostics.push({
      severity: "error",
      code: "GQ100",
      message: 'DOT format must start with "digraph" or "graph"',
      startLine: 0,
      endLine: 0,
      startCol: 0,
      endCol: trimmed.split("\n")[0].length,
    });
  }

  // Check balanced braces
  let depth = 0;
  for (const char of trimmed) {
    if (char === "{") depth++;
    if (char === "}") depth--;
  }
  if (depth !== 0) {
    diagnostics.push({
      severity: "error",
      code: "GQ101",
      message: `Unbalanced braces: ${depth > 0 ? "missing closing" : "extra closing"} '}'`,
      startLine: 0,
      endLine: 0,
      startCol: 0,
      endCol: 0,
    });
  }

  return {
    diagnostics,
    valid: !diagnostics.some((d) => d.severity === "error"),
  };
}

export function lint(code: string, format: "mermaid" | "dot" | "json"): LintResult {
  if (format === "mermaid") return lintMermaid(code);
  if (format === "dot") return lintDOT(code);
  return { diagnostics: [], valid: true };
}