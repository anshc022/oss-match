import OpenAI from "openai";
import { z } from "zod";

/**
 * One place that talks to the language model. The app targets an
 * OpenAI-compatible chat-completions endpoint, configured by env:
 *
 *   LLM_API_KEY   required to enable AI features
 *   LLM_BASE_URL  default https://api.b.ai/v1
 *   LLM_MODEL     default glm-5.3-flash
 *
 * Both AI features go through `structured`, which returns null on any failure
 * so callers fall back to their heuristic rather than breaking a page. Without
 * LLM_API_KEY the client is null and every call short-circuits to that.
 */

export const LLM_MODEL = process.env.LLM_MODEL || "glm-5.3-flash";
const BASE_URL = process.env.LLM_BASE_URL || "https://api.b.ai/v1";

const RATE_LIMIT_BACKOFF_MS = 8_000;

let cached: OpenAI | null | undefined;

export function llmClient(): OpenAI | null {
  if (cached !== undefined) return cached;
  const apiKey = process.env.LLM_API_KEY;
  // Reasoning models on this endpoint have been measured at 90s+ for small
  // replies, so the client default is generous; hot paths pass a tighter
  // per-call timeout and fall back to a heuristic when it fires.
  cached = apiKey ? new OpenAI({ apiKey, baseURL: BASE_URL, timeout: 150_000, maxRetries: 1 }) : null;
  return cached;
}

export function llmAvailable() {
  return llmClient() !== null;
}

export type StructuredOptions<S extends z.ZodType> = {
  schema: S;
  system: string;
  user: string;
  maxTokens?: number;
  /** Per-call ceiling. Background paths keep this short and fall back. */
  timeoutMs?: number;
  /**
   * How hard a reasoning model may think before answering. The provider's
   * reasoning tokens count against max_tokens, so long structured replies use
   * "low" to leave the budget for the JSON itself. Ignored by non-reasoning
   * models.
   */
  reasoningEffort?: "low" | "high" | "max";
  /** Tag for log lines. */
  label: string;
};

/**
 * Ask the model for a JSON object matching `schema`. The schema is shown to
 * the model, JSON mode is requested where the provider supports it, and the
 * reply is validated with Zod before it reaches the caller. Anything that
 * does not validate is treated as a failure, never passed through.
 */
export async function structured<S extends z.ZodType>(
  opts: StructuredOptions<S>,
): Promise<z.infer<S> | null> {
  const client = llmClient();
  if (!client) return null;

  const jsonSchema = JSON.stringify(z.toJSONSchema(opts.schema));
  const system =
    `${opts.system}\n\n` +
    `Respond with a single JSON object and nothing else: no prose, no markdown fences. ` +
    `It must match this JSON Schema exactly:\n${jsonSchema}`;

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    { role: "user", content: opts.user },
  ];

  async function call(jsonMode: boolean) {
    return client!.chat.completions.create(
      {
        model: LLM_MODEL,
        messages,
        temperature: 0.2,
        // Reasoning models spend part of this budget thinking before the JSON.
        max_tokens: opts.maxTokens ?? 4096,
        ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
        ...(opts.reasoningEffort ? { reasoning_effort: opts.reasoningEffort } : {}),
      },
      opts.timeoutMs ? { timeout: opts.timeoutMs } : undefined,
    );
  }

  try {
    let res: OpenAI.ChatCompletion;
    try {
      res = await call(true);
    } catch (err) {
      // Some compatible providers reject response_format; retry once without it.
      if (err instanceof OpenAI.BadRequestError && /response_format|json_object/i.test(err.message)) {
        res = await call(false);
      } else if (err instanceof OpenAI.RateLimitError) {
        // Deep dive fires two calls back to back and the second often lands on
        // a per-minute cap. One patient retry turns that into a hit.
        await new Promise((r) => setTimeout(r, RATE_LIMIT_BACKOFF_MS));
        res = await call(true);
      } else {
        throw err;
      }
    }

    const choice = res.choices?.[0];
    const raw = choice?.message?.content ?? "";

    // A truncated reply usually fails to parse; when it does parse, keep it.
    const parsed = opts.schema.safeParse(extractJson(raw));
    if (!parsed.success) {
      const why = choice?.finish_reason === "length" ? "truncated at max_tokens" : "failed schema";
      console.warn(`[llm:${opts.label}] ${why}:`, parsed.error.issues.slice(0, 3), `(content ${raw.length} chars)`);
      return null;
    }
    return parsed.data as z.infer<S>;
  } catch (err) {
    if (err instanceof OpenAI.AuthenticationError) {
      console.error(`[llm:${opts.label}] invalid API key`);
    } else if (err instanceof OpenAI.RateLimitError) {
      console.warn(`[llm:${opts.label}] rate limited`);
    } else if (err instanceof OpenAI.BadRequestError) {
      console.error(`[llm:${opts.label}] bad request:`, err.message);
    } else if (err instanceof OpenAI.APIConnectionTimeoutError) {
      console.warn(`[llm:${opts.label}] timed out after ${opts.timeoutMs ?? 150_000}ms; falling back`);
    } else if (err instanceof OpenAI.APIConnectionError) {
      console.warn(`[llm:${opts.label}] connection error`);
    } else if (err instanceof OpenAI.APIError) {
      console.error(`[llm:${opts.label}] API error ${err.status}:`, err.message);
    } else {
      console.error(`[llm:${opts.label}] unexpected:`, err);
    }
    return null;
  }
}

/** Tolerate a fenced or prefixed reply: take the outermost {...}. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}
