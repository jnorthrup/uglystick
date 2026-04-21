"use client";
// ─────────────────────────────────────────────────────────────────────────────
// GRAPHIQUE 2026 — HUD (Heads-Up Display)
// Floating overlay for quick-access visualization options.
// ─────────────────────────────────────────────────────────────────────────────

import { useGraphique } from "@/store/graphique-store";
import type { LayoutAlgorithm, GraphiqueTheme } from "@/lib/graph/types";
import { LAYOUT_LABELS } from "@/lib/graph/types";
import {
  Layers,
  Zap,
  TreePine,
  Circle,
  Grid3x3,
  CircleDot,
  GitBranch,
  Share2,
  Sun,
  Moon,
  Leaf,
  Dot,
  Network,
  ChevronDown,
  LayoutDashboard,
  Palette,
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

const LAYOUT_ICONS: Record<string, React.ReactNode> = {
  hierarchical: <Layers className="w-3.5 h-3.5" />,
  force: <Zap className="w-3.5 h-3.5" />,
  tree: <TreePine className="w-3.5 h-3.5" />,
  circular: <Circle className="w-3.5 h-3.5" />,
  orthogonal: <Grid3x3 className="w-3.5 h-3.5" />,
  concentric: <CircleDot className="w-3.5 h-3.5" />,
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
  { id: "dark", label: "Dark" },
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
    items: ["hierarchical", "force", "tree", "circular", "concentric", "orthogonal", "bus"] as LayoutAlgorithm[],
  },
  {
    label: "ELK Advanced",
    items: ["elk-layered", "elk-mrtree", "elk-radial", "elk-force"] as LayoutAlgorithm[],
  },
];

export default function HUD() {
  const { state, dispatch, setLayout, setTheme } = useGraphique();

  return (
    <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 p-1.5 rounded-2xl bg-surface/40 backdrop-blur-xl border border-white/10 shadow-2xl z-30 transition-all hover:bg-surface/60 hover:border-white/20">
      {/* Layout Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 gap-2 text-xs font-mono text-muted-foreground hover:text-cyan-400 hover:bg-white/5 rounded-xl"
          >
            {LAYOUT_ICONS[state.layout] || <LayoutDashboard className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">{LAYOUT_LABELS[state.layout]}</span>
            <ChevronDown className="w-3 h-3 opacity-40" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="bg-surface/90 backdrop-blur-xl border-white/10 w-52 rounded-xl mt-2">
          {LAYOUT_GROUPS.map((group) => (
            <div key={group.label}>
              <DropdownMenuLabel className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider px-2 py-1.5">
                {group.label}
              </DropdownMenuLabel>
              {group.items.map((alg) => (
                <DropdownMenuItem
                  key={alg}
                  onClick={() => setLayout(alg)}
                  className={`text-xs gap-2 rounded-lg m-1 ${
                    state.layout === alg ? "text-cyan-400 bg-cyan-500/10" : "text-muted-foreground"
                  }`}
                >
                  {LAYOUT_ICONS[alg]}
                  {LAYOUT_LABELS[alg]}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="bg-white/5" />
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="w-px h-4 bg-white/10 mx-0.5" />

      {/* Direction Controls */}
      <div className="flex items-center gap-0.5 px-1">
        {(["TB", "LR", "BT", "RL"] as const).map((dir) => (
          <Button
            key={dir}
            variant="ghost"
            size="sm"
            onClick={() => dispatch({ type: "SET_DIRECTION", direction: dir })}
            className={`h-7 w-8 text-[10px] font-mono p-0 rounded-lg transition-all ${
              state.direction === dir
                ? "text-cyan-400 bg-cyan-500/20 border border-cyan-500/30"
                : "text-muted-foreground/50 hover:text-cyan-400 hover:bg-white/5"
            }`}
          >
            {dir}
          </Button>
        ))}
      </div>

      <div className="w-px h-4 bg-white/10 mx-0.5" />

      {/* Theme Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 gap-2 text-xs font-mono text-muted-foreground hover:text-amber-400 hover:bg-white/5 rounded-xl"
          >
            {THEME_ICONS[state.theme] || <Palette className="w-3.5 h-3.5" />}
            <span className="hidden md:inline capitalize">{state.theme}</span>
            <ChevronDown className="w-3 h-3 opacity-40" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="bg-surface/90 backdrop-blur-xl border-white/10 w-44 rounded-xl mt-2">
          <DropdownMenuLabel className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider px-2 py-1.5">
            Themes
          </DropdownMenuLabel>
          {THEMES.map((t) => (
            <DropdownMenuItem
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`text-xs gap-2 rounded-lg m-1 ${
                state.theme === t.id ? "text-amber-400 bg-amber-500/10" : "text-muted-foreground"
              }`}
            >
              {THEME_ICONS[t.id]}
              {t.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
