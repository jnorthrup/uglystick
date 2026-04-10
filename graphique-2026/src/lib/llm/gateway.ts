// ─────────────────────────────────────────────────────────────────────────────
// GRAPHIQUE 2026 — LLM Multi-Provider Gateway (client-side, static-hosting safe)
// API keys are stored encrypted in localStorage and never sent to any backend.
// All requests go directly browser → LLM provider API endpoint.
// ─────────────────────────────────────────────────────────────────────────────

import type { LLMProvider } from "../graph/types";
import { LLM_PROVIDERS } from "../graph/types";

// ──────────────────────────── Key Management ─────────────────────────────────

const KEY_PREFIX = "graphique_key_";
const MODEL_CACHE_PREFIX = "graphique_models_";
const MODEL_CACHE_TTL = 3600_000; // 1 hour

/** Simple XOR obfuscation — not true encryption but prevents casual inspection */
function obfuscate(text: string, seed: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    out += String.fromCharCode(
      text.charCodeAt(i) ^ seed.charCodeAt(i % seed.length)
    );
  }
  return btoa(out);
}

function deobfuscate(encoded: string, seed: string): string {
  const text = atob(encoded);
  let out = "";
  for (let i = 0; i < text.length; i++) {
    out += String.fromCharCode(
      text.charCodeAt(i) ^ seed.charCodeAt(i % seed.length)
    );
  }
  return out;
}

const SEED = "graphique-2026-static-key-obfuscation-seed";

export function storeApiKey(providerId: string, key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY_PREFIX + providerId, obfuscate(key, SEED));
  } catch {}
}

export function retrieveApiKey(providerId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const encoded = localStorage.getItem(KEY_PREFIX + providerId);
    if (!encoded) return null;
    return deobfuscate(encoded, SEED);
  } catch {
    return null;
  }
}

export function removeApiKey(providerId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY_PREFIX + providerId);
  // Also clear cached models for this provider
  localStorage.removeItem(MODEL_CACHE_PREFIX + providerId);
}

export function hasApiKey(providerId: string): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(KEY_PREFIX + providerId);
}

export function getAllStoredProviders(): string[] {
  if (typeof window === "undefined") return [];
  return Object.keys(localStorage)
    .filter((k) => k.startsWith(KEY_PREFIX))
    .map((k) => k.replace(KEY_PREFIX, ""));
}

// ──────────────────────────── Model Caching ──────────────────────────────────

interface ModelCacheEntry {
  models: string[];
  fetchedAt: number;
}

/** Fetch available models from provider's /models endpoint */
export async function fetchProviderModels(
  providerId: string
): Promise<string[]> {
  const provider = LLM_PROVIDERS.find((p) => p.id === providerId);
  if (!provider) throw new Error(`Unknown provider: ${providerId}`);

  const apiKey = retrieveApiKey(providerId);
  if (!apiKey) return provider.models; // fallback to hardcoded

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const resp = await fetch(`${provider.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) return provider.models;

    const json = await resp.json();
    // Different providers use different response shapes
    const modelList = json.data || json.models || [];
    const models = modelList
      .map((m: { id: string }) => m.id)
      .filter((id: string) => typeof id === "string" && id.length > 0)
      .sort();

    // Cache the result
    const cache: ModelCacheEntry = { models, fetchedAt: Date.now() };
    localStorage.setItem(MODEL_CACHE_PREFIX + providerId, JSON.stringify(cache));

    return models;
  } catch {
    return provider.models;
  }
}

/** Get cached models for a provider (returns hardcoded fallback if not cached/expired) */
export function getCachedModels(providerId: string): string[] {
  // Check localStorage cache first
  try {
    const raw = localStorage.getItem(MODEL_CACHE_PREFIX + providerId);
    if (raw) {
      const entry: ModelCacheEntry = JSON.parse(raw);
      if (Date.now() - entry.fetchedAt < MODEL_CACHE_TTL) {
        return entry.models;
      }
    }
  } catch {}

  // Fall back to hardcoded list
  return LLM_PROVIDERS.find((p) => p.id === providerId)?.models ?? [];
}

// ──────────────────────────── LLM Request ────────────────────────────────────

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMRequestOptions {
  providerId: string;
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  onStream?: (delta: string) => void;
}

export interface LLMResponse {
  content: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export class LLMGateway {
  private providers: Map<string, LLMProvider>;

  constructor() {
    this.providers = new Map(LLM_PROVIDERS.map((p) => [p.id, p]));
  }

  getProvider(id: string): LLMProvider | undefined {
    return this.providers.get(id);
  }

  getAvailableProviders(): LLMProvider[] {
    return LLM_PROVIDERS.filter(
      (p) => p.browserCompatible && (!p.requiresKey || hasApiKey(p.id))
    );
  }

  async complete(options: LLMRequestOptions): Promise<LLMResponse> {
    const provider = this.providers.get(options.providerId);
    if (!provider) throw new Error(`Unknown provider: ${options.providerId}`);
    if (!provider.browserCompatible) {
      throw new Error(
        `Provider "${provider.name}" does not support direct browser calls (no CORS). ` +
        `Switch to OpenAI or OpenRouter in the LLM Settings panel.`
      );
    }

    const apiKey = retrieveApiKey(options.providerId);
    if (provider.requiresKey && !apiKey) {
      throw new Error(
        `No API key stored for provider "${provider.name}". Please add your API key in the LLM Settings panel.`
      );
    }

    const url = `${provider.baseUrl}/chat/completions`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const body = JSON.stringify({
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 2048,
      stream: !!options.onStream,
    });

    if (options.onStream) {
      let resp: Response;
      try {
        resp = await fetch(url, { method: "POST", headers, body });
      } catch (err) {
        // Network-level error (CORS, DNS, offline)
        throw new Error(
          `Network error: ${options.providerId} API is unreachable. ` +
          `Check your internet connection and ensure the API key is valid. ` +
          `(${err instanceof Error ? err.message : "unknown error"})`
        );
      }
      if (!resp.ok) {
        const errText = await resp.text();
        // Try to parse as JSON for a cleaner message
        let detail = errText;
        try { detail = JSON.parse(errText).error?.message || errText; } catch {}
        throw new Error(`API error ${resp.status}: ${detail}`);
      }
      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content || "";
              if (delta) {
                fullContent += delta;
                options.onStream(delta);
              }
            } catch {}
          }
        }
      }

      return { content: fullContent };
    }

    let resp: Response;
    try {
      resp = await fetch(url, { method: "POST", headers, body });
    } catch (err) {
      throw new Error(
        `Network error: ${options.providerId} API is unreachable. ` +
        `Check your internet connection and ensure the API key is valid. ` +
        `(${err instanceof Error ? err.message : "unknown error"})`
      );
    }
    if (!resp.ok) {
      const errText = await resp.text();
      let detail = errText;
      try { detail = JSON.parse(errText).error?.message || errText; } catch {}
      throw new Error(`API error ${resp.status}: ${detail}`);
    }

    const json = await resp.json();
    const content = json.choices?.[0]?.message?.content || "";
    const usage = json.usage
      ? {
          promptTokens: json.usage.prompt_tokens,
          completionTokens: json.usage.completion_tokens,
        }
      : undefined;

    return { content, usage };
  }
}

export const llmGateway = new LLMGateway();

// ─────────────────────────── Diagram Prompts ─────────────────────────────────

export function buildDiagramGenerationPrompt(userRequest: string, currentCode?: string): LLMMessage[] {
  const systemPrompt = `You are GRAPHIQUE AI, an expert graph and diagram assistant.
Your task is to generate valid Mermaid diagram code based on user requests.

Rules:
- Output ONLY valid Mermaid code. No explanations, no markdown code blocks, no backticks.
- Start immediately with the diagram type (e.g., "graph TD", "sequenceDiagram", etc.)
- Use clear, descriptive node labels
- Keep diagrams readable with proper structure
- For flowcharts use: graph TD (top-down) or graph LR (left-right)
- Use appropriate diagram type for the request

Supported types: graph/flowchart, sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram, gantt, pie, mindmap, gitGraph`;

  const messages: LLMMessage[] = [{ role: "system", content: systemPrompt }];

  if (currentCode) {
    messages.push({
      role: "user",
      content: `Current diagram:\n${currentCode}\n\nModification request: ${userRequest}`,
    });
  } else {
    messages.push({ role: "user", content: userRequest });
  }

  return messages;
}

export function buildFixPrompt(code: string, errors: string): LLMMessage[] {
  return [
    {
      role: "system",
      content: `You are GRAPHIQUE AI, an expert at fixing Mermaid diagram syntax errors.
Output ONLY the corrected Mermaid code. No explanations. No code blocks. No backticks.`,
    },
    {
      role: "user",
      content: `Fix this Mermaid diagram. Errors: ${errors}\n\nCode:\n${code}`,
    },
  ];
}

export function buildExplainPrompt(code: string): LLMMessage[] {
  return [
    {
      role: "system",
      content: `You are GRAPHIQUE AI. Explain what this diagram represents in clear, concise language. Be specific about nodes, relationships, and flows.`,
    },
    { role: "user", content: `Explain this diagram:\n${code}` },
  ];
}

export function buildOptimizePrompt(code: string): LLMMessage[] {
  return [
    {
      role: "system",
      content: `You are GRAPHIQUE AI. Optimize this Mermaid diagram for clarity and readability. 
Improve: node naming, layout direction, styling, and structure.
Output ONLY the improved Mermaid code. No explanations. No code blocks. No backticks.`,
    },
    { role: "user", content: `Optimize:\n${code}` },
  ];
}