"use client";
// ─────────────────────────────────────────────────────────────────────────────
// GRAPHIQUE 2026 — Code Editor (Monaco with Mermaid/DOT support)
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useGraphique } from "@/store/graphique-store";
import { SAMPLE_DIAGRAMS } from "@/lib/graph/mermaid-utils";
import {
  Code2,
  Wand2,
  Copy,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { editor } from "monaco-editor";

// Dynamically load Monaco to avoid SSR issues
const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.default),
  { ssr: false, loading: () => <EditorSkeleton /> }
);

function EditorSkeleton() {
  return (
    <div className="flex-1 bg-editor-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="w-8 h-8 border-2 border-cyan-500/40 border-t-cyan-400 rounded-full animate-spin" />
        <span className="text-xs font-mono">Loading editor…</span>
      </div>
    </div>
  );
}

// Mermaid keyword list for autocomplete
const MERMAID_KEYWORDS = [
  "graph", "flowchart", "TD", "LR", "TB", "RL", "BT",
  "sequenceDiagram", "classDiagram", "stateDiagram-v2", "erDiagram",
  "gantt", "pie", "mindmap", "gitGraph", "xychart-beta",
  "participant", "activate", "deactivate", "Note", "loop", "alt", "opt",
  "class", "interface", "abstract", "implements", "extends",
  "title", "section",
  "style", "classDef", "linkStyle", "subgraph", "end",
  "direction", "click", "callback",
];

export default function CodeEditor() {
  const { state, dispatch, setCode } = useGraphique();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [copied, setCopied] = useState(false);

  const handleEditorMount = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor, monacoInstance: typeof import("monaco-editor")) => {
      editorRef.current = editorInstance;

      // Register Mermaid language
      monacoInstance.languages.register({ id: "mermaid" });
      monacoInstance.languages.setMonarchTokensProvider("mermaid", {
        tokenizer: {
          root: [
            [/%%.*$/, "comment"],
            [/\b(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|mindmap|gitGraph|xychart)\b/, "keyword"],
            [/\b(TD|LR|TB|RL|BT|subgraph|end|style|classDef|linkStyle|direction|participant|activate|deactivate|loop|alt|opt|else|Note|title|section|click)\b/, "keyword.control"],
            // Use strings for arrow patterns to avoid JSX parser issues
            [new RegExp("(--[>ox]|===|==>|---|\\.\\.)"), "operator"],
            [/\[[^\]]*\]/, "string"],
            [/\([^)]*\)/, "type"],
            [/\{[^}]*\}/, "tag"],
            [/"[^"]*"/, "string"],
            [/[A-Za-z_][A-Za-z0-9_]*/, "identifier"],
          ],
        },
      });

      monacoInstance.languages.setLanguageConfiguration("mermaid", {
        comments: { lineComment: "%%" },
        brackets: [["[", "]"], ["(", ")"], ["{", "}"]],
        autoClosingPairs: [
          { open: "[", close: "]" },
          { open: "(", close: ")" },
          { open: "{", close: "}" },
          { open: '"', close: '"' },
        ],
      });

      // Autocomplete
      monacoInstance.languages.registerCompletionItemProvider("mermaid", {
        provideCompletionItems: (model, position) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };
          return {
            suggestions: MERMAID_KEYWORDS.map((kw) => ({
              label: kw,
              kind: monacoInstance.languages.CompletionItemKind.Keyword,
              insertText: kw,
              range,
            })),
          };
        },
      });

      // Set markers from diagnostics
      updateMarkers(editorInstance, monacoInstance);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  function updateMarkers(
    editorInstance: editor.IStandaloneCodeEditor,
    monacoInstance: typeof import("monaco-editor")
  ) {
    const model = editorInstance.getModel();
    if (!model) return;

    const markers = state.diagnostics.map((d) => ({
      startLineNumber: d.startLine + 1,
      endLineNumber: d.endLine + 1,
      startColumn: d.startCol + 1,
      endColumn: d.endCol + 1,
      message: d.message,
      severity:
        d.severity === "error"
          ? monacoInstance.MarkerSeverity.Error
          : d.severity === "warning"
          ? monacoInstance.MarkerSeverity.Warning
          : d.severity === "info"
          ? monacoInstance.MarkerSeverity.Info
          : monacoInstance.MarkerSeverity.Hint,
    }));

    monacoInstance.editor.setModelMarkers(model, "graphique-linter", markers);
  }

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(state.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [state.code]);

  const handleClear = useCallback(() => {
    setCode("graph TD\n    A[Start] --> B[End]");
  }, [setCode]);

  const loadSample = useCallback(
    (key: string) => {
      const sample = SAMPLE_DIAGRAMS[key];
      if (sample) setCode(sample);
    },
    [setCode]
  );

  const editorLanguage =
    state.format === "dot" ? "dot" : state.format === "json" ? "json" : "mermaid";

  const monacoTheme =
    state.theme === "light" ? "vs" : "vs-dark";

  return (
    <div className="flex flex-col h-full bg-editor-bg border-t border-border/40">
      {/* Editor Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30 bg-editor-header shrink-0">
        <div className="flex items-center gap-2">
          <Code2 className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-mono text-muted-foreground font-medium">
            diagram.{state.format === "mermaid" ? "mmd" : state.format === "dot" ? "dot" : "json"}
          </span>
          {state.diagnostics.length > 0 && (
            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
              {state.diagnostics.filter((d) => d.severity === "error").length} err ·{" "}
              {state.diagnostics.filter((d) => d.severity === "warning").length} warn
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Format selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs font-mono px-2 text-muted-foreground hover:text-cyan-400 gap-1"
              >
                {state.format.toUpperCase()} <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-surface border-border/60 text-sm">
              <DropdownMenuItem
                onClick={() => dispatch({ type: "SET_FORMAT", format: "mermaid" })}
                className="font-mono text-xs hover:text-cyan-400"
              >
                Mermaid (.mmd)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => dispatch({ type: "SET_FORMAT", format: "dot" })}
                className="font-mono text-xs hover:text-cyan-400"
              >
                Graphviz DOT
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => dispatch({ type: "SET_FORMAT", format: "json" })}
                className="font-mono text-xs hover:text-cyan-400"
              >
                JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Samples */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2 text-muted-foreground hover:text-amber-400 gap-1"
              >
                <Wand2 className="w-3 h-3" /> Samples
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-surface border-border/60">
              {Object.keys(SAMPLE_DIAGRAMS).map((key) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => loadSample(key)}
                  className="text-xs capitalize hover:text-amber-400"
                >
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Copy */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="w-6 h-6 text-muted-foreground hover:text-cyan-400"
            title="Copy code"
          >
            <Copy className="w-3 h-3" />
          </Button>

          {/* Clear */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="w-6 h-6 text-muted-foreground hover:text-red-400"
            title="Clear editor"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 min-h-0">
        <MonacoEditor
          height="100%"
          language={editorLanguage}
          value={state.code}
          theme={monacoTheme}
          onChange={(val) => setCode(val ?? "")}
          onMount={handleEditorMount}
          options={{
            fontSize: 13,
            fontFamily: "JetBrains Mono, Fira Code, Consolas, monospace",
            fontLigatures: true,
            lineHeight: 22,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: "on",
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
            renderLineHighlight: "gutter",
            cursorBlinking: "phase",
            cursorSmoothCaretAnimation: "on",
            smoothScrolling: true,
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: "active" },
            suggest: { showKeywords: true },
            quickSuggestions: { other: true, comments: false, strings: false },
            lineNumbers: "on",
            glyphMargin: true,
            folding: true,
            scrollbar: {
              vertical: "auto",
              horizontal: "auto",
              verticalScrollbarSize: 6,
              horizontalScrollbarSize: 6,
            },
          }}
        />
      </div>

      {/* Diagnostics Panel */}
      {state.diagnostics.length > 0 && (
        <div className="shrink-0 max-h-28 overflow-y-auto border-t border-border/30 bg-editor-bg">
          {state.diagnostics.map((d, i) => (
            <div
              key={`${d.code}-${i}`}
              className={`flex items-start gap-2 px-3 py-1 text-xs font-mono border-b border-border/10 hover:bg-surface/50 ${
                d.severity === "error"
                  ? "text-red-400"
                  : d.severity === "warning"
                  ? "text-amber-400"
                  : d.severity === "info"
                  ? "text-blue-400"
                  : "text-muted-foreground"
              }`}
            >
              <span className="shrink-0 mt-0.5">
                {d.severity === "error"
                  ? "✖"
                  : d.severity === "warning"
                  ? "⚠"
                  : d.severity === "info"
                  ? "ℹ"
                  : "·"}
              </span>
              <span>
                [{d.code}] L{d.startLine + 1}: {d.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}