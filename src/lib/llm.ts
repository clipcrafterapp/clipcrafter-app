/**
 * Provider-agnostic LLM text generation.
 *
 * All providers are called via the OpenAI-compatible chat completions API.
 * Gemini is accessed through Google's OpenAI-compatible endpoint so no
 * provider-specific SDK is needed.
 *
 * Config (env vars):
 *   LLM_PROVIDER   = gemini | openai | openrouter | sarvam | custom
 *                    default: gemini
 *   LLM_MODEL      = model name for the chosen provider
 *                    default per provider:
 *                      gemini     → gemini-2.0-flash
 *                      openai     → gpt-4o-mini
 *                      openrouter → google/gemini-2.0-flash
 *                      sarvam     → sarvam-m
 *   LLM_API_KEY    = API key (for non-Gemini providers)
 *                    Gemini uses GEMINI_API_KEY
 *   LLM_BASE_URL   = override base URL (e.g. local Ollama, custom proxy)
 *
 * Usage:
 *   import { callLLM } from "@/lib/llm";
 *   const result = await callLLM("Your prompt here");
 */

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; defaultModel: string }> = {
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.0-flash",
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "google/gemini-2.0-flash",
  },
  sarvam: {
    baseUrl: "https://api.sarvam.ai/v1",
    defaultModel: "sarvam-m",
  },
};

function getConfig() {
  const provider = (process.env.LLM_PROVIDER ?? "gemini").toLowerCase();
  const defaults = PROVIDER_DEFAULTS[provider] ?? PROVIDER_DEFAULTS.gemini;

  const model = process.env.LLM_MODEL ?? defaults.defaultModel;
  const baseUrl = process.env.LLM_BASE_URL ?? defaults.baseUrl;

  // API key: LLM_API_KEY takes precedence; fall back to Gemini key for gemini provider
  const apiKey =
    process.env.LLM_API_KEY ??
    (provider === "gemini" ? process.env.GEMINI_API_KEY : undefined) ??
    (provider === "sarvam" ? process.env.SARVAM_API_KEY : undefined) ??
    "";

  return { provider, model, baseUrl, apiKey };
}

export async function callLLM(
  prompt: string,
  opts: LLMOptions = {}
): Promise<string> {
  const { model, baseUrl, apiKey, provider } = getConfig();

  const messages: Array<{ role: string; content: string }> = [];
  if (opts.systemPrompt) {
    messages.push({ role: "system", content: opts.systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Auth header — Sarvam uses a different header name
  if (provider === "sarvam") {
    headers["api-subscription-key"] = apiKey;
  } else {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: opts.temperature ?? 0.3,
  };
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM call failed (${provider}/${model} ${res.status}): ${err.slice(0, 300)}`);
  }

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`LLM returned empty content (${provider}/${model})`);

  console.log(`[llm] ${provider}/${model} → ${content.length} chars`);
  return content;
}

/** Convenience: parse JSON from LLM output, stripping markdown fences */
export function parseLLMJson<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  return JSON.parse(cleaned) as T;
}
