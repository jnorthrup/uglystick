"use client";
// ─────────────────────────────────────────────────────────────────────────────
// GRAPHIQUE 2026 — AI Assistant Panel (LLM Multi-Provider, client-side only)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, useCallback } from "react";
import { useGraphique } from "@/store/graphique-store";
import { LLM_PROVIDERS } from "@/lib/graph/types";
import {
  llmGateway,
  storeApiKey,
  retrieveApiKey,
  hasApiKey,
  fetchProviderModels,
  getCachedModels,
  buildDiagramGenerationPrompt,
  buildFixPrompt,
  buildExplainPrompt,
  buildOptimizePrompt,
} from "@/lib/llm/gateway";
import {
  Bot,
  Send,
  Settings,
  Key,
  Trash2,
  Wand2,
  Wrench,
  MessageSquare,
  ChevronDown,
  Eye,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ChatMessage = { role: "user" | "assistant"; content: string; ts: number };

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center mr-2 shrink-0 mt-0.5">
          <Bot className="w-3 h-3 text-white" />
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-xl px-3 py-2 text-xs font-mono leading-relaxed ${
          isUser
            ? "bg-cyan-500/20 border border-cyan-500/30 text-cyan-100"
            : "bg-surface border border-border/40 text-foreground"
        }`}
      >
        <pre className="whitespace-pre-wrap break-words font-mono text-xs">
          {msg.content}
        </pre>
      </div>
    </div>
  );
}

type ActiveView = "chat" | "settings";

export default function LLMPanel() {
  const { state, dispatch, setCode } = useGraphique();
  const [view, setView] = useState<ActiveView>("chat");
  const [input, setInput] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [selectedProvider, setSelectedProvider] = useState(state.llmProvider);
  const [keyStatuses, setKeyStatuses] = useState<Record<string, boolean>>({});
  const [modelLists, setModelLists] = useState<Record<string, string[]>>({});
  const [fetchingModels, setFetchingModels] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const streamBuf = useRef("");

  // Check stored keys and load cached models on mount
  useEffect(() => {
    const statuses: Record<string, boolean> = {};
    const models: Record<string, string[]> = {};
    for (const p of LLM_PROVIDERS) {
      statuses[p.id] = hasApiKey(p.id);
      models[p.id] = getCachedModels(p.id);
    }
    setKeyStatuses(statuses);
    setModelLists(models);
  }, []);

  // Only show browser-compatible providers in UI
  const browserProviders = LLM_PROVIDERS.filter((p) => p.browserCompatible);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.llmChat]);

  const sendMessage = useCallback(
    async (userMsg: string, systemAction?: "generate" | "fix" | "explain" | "optimize") => {
      if (!userMsg.trim()) return;

      dispatch({ type: "ADD_LLM_MESSAGE", role: "user", content: userMsg });
      dispatch({ type: "SET_LLM_LOADING", loading: true });
      setInput("");

      // Check API key
      if (!hasApiKey(state.llmProvider)) {
        dispatch({
          type: "ADD_LLM_MESSAGE",
          role: "assistant",
          content: `⚠ No API key found for "${state.llmProvider}". Please add your key in the Settings tab (⚙).`,
        });
        dispatch({ type: "SET_LLM_LOADING", loading: false });
        return;
      }

      let messages;
      switch (systemAction) {
        case "fix":
          messages = buildFixPrompt(state.code, userMsg);
          break;
        case "explain":
          messages = buildExplainPrompt(state.code);
          break;
        case "optimize":
          messages = buildOptimizePrompt(state.code);
          break;
        default:
          messages = buildDiagramGenerationPrompt(userMsg, state.code);
      }

      streamBuf.current = "";

      // Add placeholder for streaming
      dispatch({ type: "ADD_LLM_MESSAGE", role: "assistant", content: "▋" });

      try {
        await llmGateway.complete({
          providerId: state.llmProvider,
          model: state.llmModel,
          messages,
          onStream: (delta) => {
            streamBuf.current += delta;
            // Update last message in chat
            dispatch({
              type: "ADD_LLM_MESSAGE",
              role: "assistant",
              content: "__STREAM_UPDATE__",
            });
          },
        });

        // Final update
        const final = streamBuf.current;
        // Replace last message
        const newChat = [...state.llmChat];
        // Remove placeholder (last assistant message)
        const lastIdx = [...state.llmChat].reverse().findIndex((m) => m.role === "assistant");
        if (lastIdx !== -1) {
          const realIdx = state.llmChat.length - 1 - lastIdx;
          newChat[realIdx] = { role: "assistant", content: final, ts: Date.now() };
        }

        // If response looks like Mermaid code, offer to apply
        const looksLikeMermaid =
          /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|mindmap|gitGraph)/im.test(
            final.trim()
          );
        if (looksLikeMermaid && (systemAction === "generate" || systemAction === "fix" || systemAction === "optimize")) {
          setCode(final.trim());
          dispatch({
            type: "ADD_LLM_MESSAGE",
            role: "assistant",
            content: `✓ Applied to editor:\n\n${final.trim()}`,
          });
        } else {
          dispatch({
            type: "ADD_LLM_MESSAGE",
            role: "assistant",
            content: final,
          });
        }
      } catch (err) {
        dispatch({
          type: "ADD_LLM_MESSAGE",
          role: "assistant",
          content: `✖ Error: ${err instanceof Error ? err.message : String(err)}`,
        });
      } finally {
        dispatch({ type: "SET_LLM_LOADING", loading: false });
      }
    },
    [state.llmProvider, state.llmModel, state.code, state.llmChat, dispatch, setCode]
  );

  const handleSaveKey = useCallback(async () => {
    if (!apiKeyInput.trim()) return;
    storeApiKey(selectedProvider, apiKeyInput.trim());
    setKeyStatuses((s) => ({ ...s, [selectedProvider]: true }));
    setApiKeyInput("");
    // Fetch and cache models for this provider
    setFetchingModels(true);
    const models = await fetchProviderModels(selectedProvider);
    setModelLists((prev) => ({ ...prev, [selectedProvider]: models }));
    setFetchingModels(false);
  }, [selectedProvider, apiKeyInput]);

  const handleRefreshModels = useCallback(async () => {
    setFetchingModels(true);
    const models = await fetchProviderModels(state.llmProvider);
    setModelLists((prev) => ({ ...prev, [state.llmProvider]: models }));
    setFetchingModels(false);
  }, [state.llmProvider]);

  const visibleChat = state.llmChat.filter(
    (m) => m.content !== "▋" && m.content !== "__STREAM_UPDATE__"
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Inline tab switcher (replaces removed header) */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/20 bg-panel-header/80 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
            <Bot className="w-2.5 h-2.5 text-white" />
          </div>
          <span className="text-[10px] font-semibold text-foreground">AI Assistant</span>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView(view === "chat" ? "settings" : "chat")}
            className={`h-5 text-[10px] px-1.5 ${view === "settings" ? "text-amber-400" : "text-muted-foreground/60"}`}
            title="Settings"
          >
            <Settings className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => dispatch({ type: "CLEAR_LLM_CHAT" })}
            className="w-5 h-5 text-muted-foreground/40 hover:text-red-400"
            title="Clear chat"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {view === "settings" ? (
        /* Settings View */
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <div>
            <p className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider mb-2">
              Provider & Model
            </p>

            {/* Provider selector */}
            <div className="mb-2">
              <label className="text-xs text-muted-foreground mb-1 block">Provider</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-between h-7 text-xs font-mono border-border/50 bg-surface"
                  >
                    {LLM_PROVIDERS.find((p) => p.id === state.llmProvider)?.name ?? state.llmProvider}
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-surface border-border/60 w-64">
                  {browserProviders.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => {
                        dispatch({ type: "SET_LLM_PROVIDER", provider: p.id });
                        setSelectedProvider(p.id);
                      }}
                      className={`text-xs gap-2 ${
                        state.llmProvider === p.id ? "text-purple-400 bg-purple-500/10" : ""
                      }`}
                    >
                      <span className="flex-1">{p.name}</span>
                      {keyStatuses[p.id] ? (
                        <span className="text-green-400 text-[10px]">● key set</span>
                      ) : (
                        <span className="text-red-400 text-[10px]">○ no key</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Model selector */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-muted-foreground">Model</label>
                <button
                  type="button"
                  onClick={handleRefreshModels}
                  className="text-[9px] font-mono text-muted-foreground/50 hover:text-purple-400 transition-colors"
                  title="Refresh model list from API"
                >
                  {fetchingModels ? "refreshing…" : "↻ refresh"}
                </button>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-between h-7 text-xs font-mono border-border/50 bg-surface"
                  >
                    {state.llmModel}
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-surface border-border/60 max-h-64 overflow-y-auto">
                  {(modelLists[state.llmProvider] ?? LLM_PROVIDERS.find((p) => p.id === state.llmProvider)?.models ?? []).map(
                    (m) => (
                      <DropdownMenuItem
                        key={m}
                        onClick={() => dispatch({ type: "SET_LLM_MODEL", model: m })}
                        className={`text-xs font-mono ${
                          state.llmModel === m ? "text-purple-400 bg-purple-500/10" : ""
                        }`}
                      >
                        {m}
                      </DropdownMenuItem>
                    )
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* API Key Input */}
          <div>
            <p className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider mb-2">
              API Keys
            </p>
            <div className="space-y-2">
              {/* Provider key selector */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Set key for:
                </label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-between h-7 text-xs font-mono border-border/50 bg-surface"
                    >
                      {LLM_PROVIDERS.find((p) => p.id === selectedProvider)?.name ?? selectedProvider}
                      <ChevronDown className="w-3 h-3 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-surface border-border/60">
                    {browserProviders.map((p) => (
                      <DropdownMenuItem
                        key={p.id}
                        onClick={() => setSelectedProvider(p.id)}
                        className="text-xs"
                      >
                        {p.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <Input
                type="password"
                placeholder="sk-..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveKey()}
                className="h-7 text-xs font-mono bg-editor-bg border-border/50"
              />

              <Button
                size="sm"
                onClick={handleSaveKey}
                className="w-full h-7 text-xs gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Key className="w-3 h-3" />
                Save Key (localStorage)
              </Button>
            </div>

            {/* Key status list */}
            <div className="mt-3 space-y-1">
              {browserProviders.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-1">
                  <span className="text-xs text-muted-foreground">{p.name}</span>
                  {keyStatuses[p.id] ? (
                    <span className="text-[10px] font-mono text-green-400">● stored</span>
                  ) : (
                    <span className="text-[10px] font-mono text-muted-foreground/40">○ not set</span>
                  )}
                </div>
              ))}
            </div>

            <p className="text-[9px] text-muted-foreground/40 mt-3 leading-relaxed">
              Keys are stored encrypted in your browser's localStorage. They never leave
              your device except for direct API calls to the provider's endpoint.
              This app is fully static — no backend receives your keys.
            </p>
          </div>
        </div>
      ) : (
        /* Chat View */
        <>
          {/* Quick Actions */}
          <div className="flex flex-wrap gap-1 p-2 border-b border-border/20 shrink-0">
            <button
              type="button"
              onClick={() => sendMessage("Generate a fresh diagram", "generate")}
              className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded bg-surface border border-border/40 text-muted-foreground hover:text-purple-400 hover:border-purple-500/40 transition-colors"
            >
              <Wand2 className="w-2.5 h-2.5" /> Generate
            </button>
            <button
              type="button"
              onClick={() => sendMessage("Fix all syntax errors", "fix")}
              className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded bg-surface border border-border/40 text-muted-foreground hover:text-red-400 hover:border-red-500/40 transition-colors"
            >
              <Wrench className="w-2.5 h-2.5" /> Fix
            </button>
            <button
              type="button"
              onClick={() => sendMessage("Explain this diagram", "explain")}
              className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded bg-surface border border-border/40 text-muted-foreground hover:text-blue-400 hover:border-blue-500/40 transition-colors"
            >
              <Eye className="w-2.5 h-2.5" /> Explain
            </button>
            <button
              type="button"
              onClick={() => sendMessage("Optimize for clarity", "optimize")}
              className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded bg-surface border border-border/40 text-muted-foreground hover:text-amber-400 hover:border-amber-500/40 transition-colors"
            >
              <Sparkles className="w-2.5 h-2.5" /> Optimize
            </button>
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto p-3">
            {visibleChat.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600/30 to-blue-600/30 border border-purple-500/30 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-foreground/70 font-semibold mb-1">
                    GRAPHIQUE AI
                  </p>
                  <p className="text-[11px] text-muted-foreground/60 leading-relaxed max-w-52">
                    Ask me to generate, fix, explain, or optimize your diagrams.
                    Uses your stored API keys to call LLM providers directly.
                  </p>
                </div>
              </div>
            )}
            {visibleChat.map((msg) => (
              <ChatBubble key={msg.ts} msg={msg} />
            ))}
            {state.llmLoading && (
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shrink-0">
                  <Bot className="w-3 h-3 text-white" />
                </div>
                <div className="bg-surface border border-border/40 rounded-xl px-3 py-2">
                  <Loader2 className="w-3 h-3 text-purple-400 animate-spin" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-2 border-t border-border/30 shrink-0">
            <div className="flex gap-1.5">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(input);
                  }
                }}
                placeholder="Ask AI to generate or modify…"
                rows={2}
                className="flex-1 text-xs font-mono resize-none bg-editor-bg border-border/50 placeholder:text-muted-foreground/40"
              />
              <Button
                size="icon"
                onClick={() => sendMessage(input)}
                disabled={state.llmLoading || !input.trim()}
                className="w-9 h-9 self-end bg-purple-600 hover:bg-purple-700 text-white shrink-0"
              >
                {state.llmLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] font-mono text-muted-foreground/40">
                {LLM_PROVIDERS.find((p) => p.id === state.llmProvider)?.name} · {state.llmModel}
              </span>
              <span className="text-[9px] font-mono text-muted-foreground/40">
                Enter to send · Shift+Enter newline
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}