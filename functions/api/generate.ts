/** Workers AI model — multimodal Gemma (screenshot → JSON). */
const MODEL = "@cf/google/gemma-3-12b-it";

/** ~3 MB base64 payload cap to stay within Workers request limits. */
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

interface GenerateRequest {
  system: string;
  user: string;
  imageDataUrl?: string;
  maxTokens?: number;
}

function corsHeaders(origin: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
  };
  if (origin) headers["access-control-allow-origin"] = origin;
  return headers;
}

function jsonResponse(body: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

function extractModelText(result: unknown): string {
  if (!result || typeof result !== "object") {
    throw new Error("Workers AI returned an empty response");
  }
  const record = result as Record<string, unknown>;
  if (typeof record.response === "string" && record.response.trim()) {
    return record.response;
  }
  const choices = record.choices as Array<{ message?: { content?: string } }> | undefined;
  const fromChoice = choices?.[0]?.message?.content;
  if (typeof fromChoice === "string" && fromChoice.trim()) return fromChoice;
  throw new Error("Workers AI response did not contain text");
}

export const onRequestOptions: PagesFunction<Env> = async ({ request }) =>
  new Response(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const origin = request.headers.get("origin");
  const cors = corsHeaders(origin);

  let body: GenerateRequest;
  try {
    body = (await request.json()) as GenerateRequest;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, cors);
  }

  if (!body.system?.trim() || !body.user?.trim()) {
    return jsonResponse({ error: "system and user are required" }, 400, cors);
  }

  const messages = [
    { role: "system", content: body.system },
    { role: "user", content: body.user },
  ];

  const inputs: Record<string, unknown> = {
    messages,
    max_tokens: body.maxTokens ?? 8192,
    temperature: 0.4,
  };

  if (body.imageDataUrl) {
    const parsed = parseDataUrl(body.imageDataUrl);
    if (!parsed) {
      return jsonResponse({ error: "imageDataUrl must be a valid data URL" }, 400, cors);
    }
    const byteLength = Math.ceil((parsed.base64.length * 3) / 4);
    if (byteLength > MAX_IMAGE_BYTES) {
      return jsonResponse(
        { error: `Image too large (${Math.round(byteLength / 1024)} KB). Max is ${MAX_IMAGE_BYTES / 1024 / 1024} MB.` },
        413,
        cors,
      );
    }
    inputs.image = body.imageDataUrl;
  }

  try {
    const result = await env.AI.run(MODEL, inputs);
    const text = extractModelText(result);
    return jsonResponse({ text }, 200, cors);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Workers AI request failed";
    return jsonResponse({ error: message }, 502, cors);
  }
};
