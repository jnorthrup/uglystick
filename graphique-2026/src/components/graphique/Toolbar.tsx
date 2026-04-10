"use client";
// ─────────────────────────────────────────────────────────────────────────────
// GRAPHIQUE 2026 — Top Toolbar
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useState } from "react";
import { useGraphique } from "@/store/graphique-store";
import type { LayoutAlgorithm, GraphiqueTheme } from "@/lib/graph/types";
import { LAYOUT_LABELS, LLM_PROVIDERS } from "@/lib/graph/types";
import { SAMPLE_DIAGRAMS } from "@/lib/graph/mermaid-utils";
import {
  exportToPNG,
  exportToSVG,
  exportToText,
  exportToPDF,
} from "@/lib/export";
import {
  Network,
  LayoutDashboard,
  Palette,
  Download,
  Code2,
  SlidersHorizontal,
  Map,
  Bot,
  ChevronDown,
  FileDown,
  Share2,
  Layers,
  GitBranch,
  Circle,
  TreePine,
  Zap,
  Grid3x3,
  Sun,
  Moon,
  Leaf,
  Dot,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const LAYOUT_ICONS: Record<string, React.ReactNode> = {
  hierarchical: <Layers className="w-3.5 h-3.5" />,
  force: <Zap className="w-3.5 h-3.5" />,
  tree: <TreePine className="w-3.5 h-3.5" />,
  circular: <Circle className="w-3.5 h-3.5" />,
  orthogonal: <Grid3x3 className="w-3.5 h-3.5" />,
  "elk-layered": <GitBranch className="w-3.5 h-3.5" />,
  "elk-mrtree": <TreePine className="w-3.5 h-3.5" />,
  "elk-radial": <Circle className="w-3.5 h-3.5" />,
  "elk-force": <Zap className="w-3.5 h-3.5" />,
  bus: <Share2 className="w-3.5 h-3.5" />,
};

const THEME_ICONS: Record<string, React.ReactNode> = {
  dark: <Moon className="w-3.5 h-3.5" />,
  light: <Sun className="w-3.5 h-3.5" />,
  forest: <Leaf className="w-3.5 h-3.5" />,
  neutral: <Dot className="w-3.5 h-3.5" />,
  observatory: <Network className="w-3.5 h-3.5" />,
  dracula: <Moon className="w-3.5 h-3.5" />,
  nord: <Moon className="w-3.5 h-3.5" />,
};

const THEMES: { id: GraphiqueTheme; label: string }[] = [
  { id: "dark", label: "Dark (Default)" },
  { id: "light", label: "Light" },
  { id: "forest", label: "Forest" },
  { id: "neutral", label: "Neutral" },
  { id: "observatory", label: "Observatory" },
  { id: "dracula", label: "Dracula" },
  { id: "nord", label: "Nord" },
];

const LAYOUT_GROUPS = [
  {
    label: "Standard",
    items: ["hierarchical", "force", "tree", "circular", "orthogonal", "bus"] as LayoutAlgorithm[],
  },
  {
    label: "ELK Advanced",
    items: ["elk-layered", "elk-mrtree", "elk-radial", "elk-force"] as LayoutAlgorithm[],
  },
];

export default function Toolbar() {
  const { state, dispatch, setLayout, setTheme } = useGraphique();
  const [exporting, setExporting] = useState(false);

  const getSvgElement = (): SVGElement | null => {
    return document.querySelector(".graph-canvas-wrapper svg");
  };

  const handleExportPNG = useCallback(async () => {
    const svg = getSvgElement();
    if (!svg) return;
    setExporting(true);
    try {
      await exportToPNG(svg, { scale: 2, background: "#0D1117" });
    } finally {
      setExporting(false);
    }
  }, []);

  const handleExportSVG = useCallback(() => {
    const svg = getSvgElement();
    if (!svg) return;
    exportToSVG(svg);
  }, []);

  const handleExportPDF = useCallback(async () => {
    const svg = getSvgElement();
    if (!svg) return;
    setExporting(true);
    try {
      await exportToPDF(svg);
    } finally {
      setExporting(false);
    }
  }, []);

  const handleExportMermaid = useCallback(() => {
    exportToText(state.code, "mermaid");
  }, [state.code]);

  const handleExportDOT = useCallback(() => {
    exportToText(state.code, "dot");
  }, [state.code]);

  return (
    <TooltipProvider delayDuration={400}>
      <header className="flex items-center h-11 px-3 gap-1 border-b border-border/40 bg-header shrink-0 z-20 select-none">
        {/* Logo */}
        <div className="flex items-center gap-2 mr-3">
          <div className="relative w-7 h-7">
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 opacity-90" />
            <Network className="absolute inset-0 m-auto w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold tracking-tight text-foreground font-syne">
              GRAPHIQUE
            </span>
            <span className="text-[9px] text-cyan-500/70 font-mono tracking-widest uppercase">
              2026
            </span>
          </div>
        </div>

        <div className="w-px h-5 bg-border/40 mx-1" />

        {/* Layout Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs font-mono text-muted-foreground hover:text-cyan-400 hover:bg-surface"
            >
              {LAYOUT_ICONS[state.layout] || <LayoutDashboard className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{LAYOUT_LABELS[state.layout]}</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-surface border-border/60 w-52">
            {LAYOUT_GROUPS.map((group) => (
              <div key={group.label}>
                <DropdownMenuLabel className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider px-2 py-1.5">
                  {group.label}
                </DropdownMenuLabel>
                {group.items.map((alg) => (
                  <DropdownMenuItem
                    key={alg}
                    onClick={() => setLayout(alg)}
                    className={`text-xs gap-2 hover:text-cyan-400 ${
                      state.layout === alg ? "text-cyan-400 bg-cyan-500/10" : "text-muted-foreground"
                    }`}
                  >
                    {LAYOUT_ICONS[alg]}
                    {LAYOUT_LABELS[alg]}
                    {state.layout === alg && (
                      <span className="ml-auto text-[10px] text-cyan-500">active</span>
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator className="bg-border/30" />
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Theme Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs font-mono text-muted-foreground hover:text-amber-400 hover:bg-surface"
            >
              {THEME_ICONS[state.theme] || <Palette className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline capitalize">{state.theme}</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-surface border-border/60 w-44">
            <DropdownMenuLabel className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">
              Themes
            </DropdownMenuLabel>
            {THEMES.map((t) => (
              <DropdownMenuItem
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`text-xs gap-2 hover:text-amber-400 ${
                  state.theme === t.id ? "text-amber-400 bg-amber-500/10" : "text-muted-foreground"
                }`}
              >
                {THEME_ICONS[t.id]}
                {t.label}
                {state.theme === t.id && (
                  <span className="ml-auto text-[10px] text-amber-500">✓</span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Direction quick-toggles (for flowcharts) */}
        <div className="flex items-center gap-0.5">
          {(["TB", "LR", "BT", "RL"] as const).map((dir) => (
            <Tooltip key={dir}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => dispatch({ type: "SET_DIRECTION", direction: dir })}
                  className={`h-7 w-8 text-[10px] font-mono p-0 ${
                    state.direction === dir
                      ? "text-cyan-400 bg-cyan-500/15 border border-cyan-500/30"
                      : "text-muted-foreground/60 hover:text-cyan-400"
                  }`}
                >
                  {dir}
                </Button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                Direction:{" "}
                {dir === "TB"
                  ? "Top→Bottom"
                  : dir === "LR"
                  ? "Left→Right"
                  : dir === "BT"
                  ? "Bottom→Top"
                  : "Right→Left"}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        <div className="w-px h-5 bg-border/40 mx-1" />

        {/* Export Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={exporting}
              className="h-8 gap-1.5 text-xs font-mono text-muted-foreground hover:text-green-400 hover:bg-surface"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-surface border-border/60">
            <DropdownMenuLabel className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">
              Raster
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={handleExportPNG} className="text-xs gap-2 hover:text-green-400">
              <Download className="w-3.5 h-3.5" /> PNG (2×)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportPDF} className="text-xs gap-2 hover:text-green-400">
              <Download className="w-3.5 h-3.5" /> PDF
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border/30" />
            <DropdownMenuLabel className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">
              Vector
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={handleExportSVG} className="text-xs gap-2 hover:text-green-400">
              <Download className="w-3.5 h-3.5" /> SVG
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border/30" />
            <DropdownMenuLabel className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">
              Source
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={handleExportMermaid} className="text-xs gap-2 hover:text-green-400">
              <Download className="w-3.5 h-3.5" /> Mermaid (.mmd)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportDOT} className="text-xs gap-2 hover:text-green-400">
              <Download className="w-3.5 h-3.5" /> Graphviz DOT
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Panel toggles */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => dispatch({ type: "TOGGLE_EDITOR" })}
                className={`w-8 h-8 ${state.editorOpen ? "text-cyan-400 bg-cyan-500/10" : "text-muted-foreground"}`}
              >
                <Code2 className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Toggle Editor</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => dispatch({ type: "TOGGLE_PROPERTIES" })}
                className={`w-8 h-8 ${state.propertiesOpen ? "text-amber-400 bg-amber-500/10" : "text-muted-foreground"}`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Toggle Properties</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => dispatch({ type: "TOGGLE_MINIMAP" })}
                className={`w-8 h-8 ${state.minimapOpen ? "text-green-400 bg-green-500/10" : "text-muted-foreground"}`}
              >
                <Map className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Toggle Minimap</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => dispatch({ type: "TOGGLE_LLM" })}
                className={`w-8 h-8 ${state.llmOpen ? "text-purple-400 bg-purple-500/10" : "text-muted-foreground"}`}
              >
                <Bot className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">AI Assistant</TooltipContent>
          </Tooltip>
        </div>
      </header>
    </TooltipProvider>
  );
}