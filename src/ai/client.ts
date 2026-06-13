import { useSettingsStore } from "../state/settingsStore";
import { useWorkersAI } from "./config";

export interface AIRequest {
  system: string;
  user: string;
  /** Optional image (data URL) attached to the user message. */
  imageDataUrl?: string;
  maxTokens?: number;
}

export class AIError extends Error {
  /** When true, caller may retry with BYOK providers. */
  workersUnavailable?: boolean;
}

function splitDataUrl(dataUrl: string): { mediaType: string; base64: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new AIError("画像データの形式が不正です");
  return { mediaType: match[1], base64: match[2] };
}

async function callWorkersAI(request: AIRequest): Promise<string> {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  const data = (await response.json().catch(() => null)) as { text?: string; error?: string } | null;

  if (response.status === 404) {
    const error = new AIError("Workers AI backend is not available");
    error.workersUnavailable = true;
    throw error;
  }
  if (!response.ok) {
    throw new AIError(data?.error || `Workers AI error (${response.status})`);
  }
  const text = data?.text?.trim();
  if (!text) throw new AIError("AIから空の応答が返りました");
  return text;
}

async function callAnthropic(request: AIRequest, key: string, model: string): Promise<string> {
  const content: unknown[] = [];
  if (request.imageDataUrl) {
    const { mediaType, base64 } = splitDataUrl(request.imageDataUrl);
    content.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data: base64 },
    });
  }
  content.push({ type: "text", text: request.user });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: request.maxTokens ?? 8192,
      system: request.system,
      messages: [{ role: "user", content }],
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AIError(data?.error?.message || `Anthropic API error (${response.status})`);
  }
  const text = (data?.content ?? [])
    .filter((block: { type: string }) => block.type === "text")
    .map((block: { text: string }) => block.text)
    .join("");
  if (!text) throw new AIError("AIから空の応答が返りました");
  return text;
}

async function callOpenAI(request: AIRequest, key: string, model: string): Promise<string> {
  const userContent: unknown[] = [{ type: "text", text: request.user }];
  if (request.imageDataUrl) {
    userContent.push({ type: "image_url", image_url: { url: request.imageDataUrl } });
  }
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      max_completion_tokens: request.maxTokens ?? 8192,
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: userContent },
      ],
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AIError(data?.error?.message || `OpenAI API error (${response.status})`);
  }
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new AIError("AIから空の応答が返りました");
  return text;
}

async function callGemini(request: AIRequest, key: string, model: string): Promise<string> {
  const parts: unknown[] = [{ text: request.user }];
  if (request.imageDataUrl) {
    const { mediaType, base64 } = splitDataUrl(request.imageDataUrl);
    parts.push({ inline_data: { mime_type: mediaType, data: base64 } });
  }
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: request.system }] },
        contents: [{ role: "user", parts }],
        generationConfig: { maxOutputTokens: request.maxTokens ?? 8192 },
      }),
    },
  );
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AIError(data?.error?.message || `Gemini API error (${response.status})`);
  }
  const text = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((part: { text?: string }) => part.text ?? "")
    .join("");
  if (!text) throw new AIError("AIから空の応答が返りました");
  return text;
}

async function callByok(request: AIRequest): Promise<string> {
  const { provider, keys, models } = useSettingsStore.getState();
  const key = keys[provider];
  if (!key) {
    throw new AIError("APIキーが未設定です。右上の設定からキーを登録してください。");
  }
  const model = models[provider];
  switch (provider) {
    case "anthropic":
      return callAnthropic(request, key, model);
    case "openai":
      return callOpenAI(request, key, model);
    case "gemini":
      return callGemini(request, key, model);
  }
}

export async function callAI(request: AIRequest): Promise<string> {
  if (useWorkersAI()) {
    try {
      return await callWorkersAI(request);
    } catch (error) {
      if (error instanceof AIError && error.workersUnavailable) {
        return callByok(request);
      }
      throw error;
    }
  }
  return callByok(request);
}

/** Extracts the first JSON object from an LLM response (handles ``` fences and prose). */
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  if (start < 0) throw new AIError("AIの応答からJSONを抽出できませんでした");
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < candidate.length; i += 1) {
    const char = candidate[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      if (inString) escaped = true;
      continue;
    }
    if (char === '"') inString = !inString;
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(candidate.slice(start, i + 1)) as T;
      }
    }
  }
  throw new AIError("AIの応答のJSONが不完全です");
}
