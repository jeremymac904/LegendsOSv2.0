import {
  canCallImageProvider,
  canCallTextProvider,
  getServerEnv,
  PUBLIC_ENV,
} from "@/lib/env";

import type {
  ChatRequest,
  ChatResponse,
  GatewayError,
  GatewayResult,
  ImageRequest,
  ImageResponse,
  ProviderId,
} from "./types";

// System prompt: Atlas is the internal assistant. The NMLS branding line is
// auto-applied to outbound marketing copy. This is NOT a compliance gate —
// it's just the team's standard sign-off, configurable via env.
function defaultSystemPrompt(): string {
  return [
    "You are Atlas, the internal AI assistant for the Legends Mortgage Team powered by Loan Factory.",
    "You assist Jeremy McDonald and licensed loan officers with mortgage marketing, client education, and operational tasks.",
    `When generating outbound marketing copy, include this branding line at the end: "${PUBLIC_ENV.BRAND_LINE}"`,
    "Decline to provide regulated legal, tax, or financial advice that requires a licensed professional review.",
  ].join(" ");
}

function err(
  code: GatewayError["error"],
  message: string,
  extra: Partial<GatewayError> = {}
): GatewayError {
  return { ok: false, error: code, message, ...extra };
}

// =====================================================================
// CHAT
// =====================================================================

export async function runChat(
  request: ChatRequest
): Promise<GatewayResult<ChatResponse>> {
  const env = getServerEnv();
  const requested = (request.provider ?? env.AI_DEFAULT_TEXT_PROVIDER) as ProviderId;

  // Resolve a usable provider with simple fallback: requested → openrouter →
  // deepseek → nvidia. Stops on the first one that is configured AND enabled.
  const order: ProviderId[] = Array.from(
    new Set([requested, "openrouter", "deepseek", "nvidia"] as ProviderId[])
  );

  let lastReason: GatewayError | null = null;
  for (const candidate of order) {
    if (candidate !== "openrouter" && candidate !== "deepseek" && candidate !== "nvidia") {
      continue;
    }
    const gate = canCallTextProvider(candidate);
    if (!gate.ok) {
      lastReason = err(
        gate.reason === "provider_disabled_by_owner"
          ? "provider_disabled"
          : "provider_not_configured",
        gate.reason === "provider_disabled_by_owner"
          ? `${candidate} is disabled by the owner (${gate.envVar}).`
          : `${candidate} is not configured. Set ${gate.envVar} in environment.`,
        { provider: candidate, env_var: gate.envVar }
      );
      continue;
    }
    if (candidate === "openrouter") {
      return openrouterChat(
        request,
        env.OPENROUTER_API_KEY,
        env.OPENROUTER_BASE_URL,
        request.model ?? env.OPENROUTER_DEFAULT_MODEL
      );
    }
    if (candidate === "deepseek") {
      return deepseekChat(
        request,
        env.DEEPSEEK_API_KEY,
        env.DEEPSEEK_BASE_URL,
        request.model ?? env.DEEPSEEK_DEFAULT_MODEL
      );
    }
    if (candidate === "nvidia") {
      const fallbackModel =
        env.NVIDIA_MODELS.nemotron_super_120b ||
        env.NVIDIA_MODELS.kimi_k2_5 ||
        env.NVIDIA_MODELS.mistral_small_4_119b ||
        "meta/llama-3.1-70b-instruct";
      return nvidiaChat(
        request,
        env.NVIDIA_API_KEY,
        env.NVIDIA_BASE_URL,
        request.model ?? fallbackModel
      );
    }
  }

  // Nothing was callable.
  return (
    lastReason ??
    err("provider_not_configured", "No text provider is configured.", {
      provider: requested,
    })
  );
}

async function openrouterChat(
  request: ChatRequest,
  apiKey: string,
  baseUrl: string,
  model: string
): Promise<GatewayResult<ChatResponse>> {
  const messages = ensureSystem(request.messages);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": PUBLIC_ENV.APP_URL,
        "X-Title": PUBLIC_ENV.APP_NAME,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: request.temperature ?? 0.4,
        max_tokens: request.max_tokens ?? 1500,
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      return err(
        "provider_error",
        `OpenRouter ${res.status}: ${text.slice(0, 400)}`,
        { provider: "openrouter", status: res.status }
      );
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: ChatResponse["usage"];
    };
    return {
      ok: true,
      provider: "openrouter",
      model,
      content: json.choices?.[0]?.message?.content ?? "",
      usage: json.usage,
    };
  } catch (e) {
    return err("internal_error", e instanceof Error ? e.message : "OpenRouter failed", {
      provider: "openrouter",
    });
  }
}

async function deepseekChat(
  request: ChatRequest,
  apiKey: string,
  baseUrl: string,
  model: string
): Promise<GatewayResult<ChatResponse>> {
  const messages = ensureSystem(request.messages);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: request.temperature ?? 0.4,
        max_tokens: request.max_tokens ?? 1500,
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      return err(
        "provider_error",
        `DeepSeek ${res.status}: ${text.slice(0, 400)}`,
        { provider: "deepseek", status: res.status }
      );
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: ChatResponse["usage"];
    };
    return {
      ok: true,
      provider: "deepseek",
      model,
      content: json.choices?.[0]?.message?.content ?? "",
      usage: json.usage,
    };
  } catch (e) {
    return err(
      "internal_error",
      e instanceof Error ? e.message : "DeepSeek failed",
      { provider: "deepseek" }
    );
  }
}

async function nvidiaChat(
  request: ChatRequest,
  apiKey: string,
  baseUrl: string,
  model: string
): Promise<GatewayResult<ChatResponse>> {
  const messages = ensureSystem(request.messages);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: request.temperature ?? 0.4,
        max_tokens: request.max_tokens ?? 1500,
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      return err(
        "provider_error",
        `NVIDIA ${res.status}: ${text.slice(0, 400)}`,
        { provider: "nvidia", status: res.status }
      );
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: ChatResponse["usage"];
    };
    return {
      ok: true,
      provider: "nvidia",
      model,
      content: json.choices?.[0]?.message?.content ?? "",
      usage: json.usage,
    };
  } catch (e) {
    return err(
      "internal_error",
      e instanceof Error ? e.message : "NVIDIA failed",
      { provider: "nvidia" }
    );
  }
}

function ensureSystem(messages: ChatRequest["messages"]) {
  if (messages.length === 0 || messages[0].role !== "system") {
    return [{ role: "system" as const, content: defaultSystemPrompt() }, ...messages];
  }
  return messages;
}

// =====================================================================
// IMAGE
// =====================================================================

export async function runImage(
  request: ImageRequest
): Promise<GatewayResult<ImageResponse>> {
  const env = getServerEnv();
  const provider = (request.provider ?? "fal") as ProviderId;

  if (provider !== "fal") {
    return err("bad_request", `Image provider ${provider} is not supported.`, {
      provider,
    });
  }

  const gate = canCallImageProvider();
  if (!gate.ok) {
    return err(
      gate.reason === "provider_disabled_by_owner"
        ? "provider_disabled"
        : "provider_not_configured",
      gate.reason === "provider_disabled_by_owner"
        ? `Fal.ai is disabled by the owner (${gate.envVar}).`
        : `Fal.ai is not configured. Set ${gate.envVar} in environment.`,
      { provider: "fal", env_var: gate.envVar }
    );
  }

  const model = request.model ?? env.FAL_DEFAULT_MODEL;
  try {
    const res = await fetch(`https://fal.run/${model}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Key ${env.FAL_KEY}`,
      },
      body: JSON.stringify({
        prompt: request.prompt,
        image_size: mapAspectToFalSize(request.aspect_ratio),
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      return err(
        "provider_error",
        `Fal.ai ${res.status}: ${text.slice(0, 400)}`,
        { provider: "fal", status: res.status }
      );
    }
    const json = (await res.json()) as {
      images?: { url: string }[];
      image?: { url: string };
    };
    const url = json.images?.[0]?.url ?? json.image?.url ?? "";
    if (!url) {
      return err("provider_error", "Fal.ai returned no image URL.", {
        provider: "fal",
      });
    }
    return {
      ok: true,
      provider: "fal",
      model,
      image_url: url,
      cost_estimate: 0.01,
    };
  } catch (e) {
    return err(
      "internal_error",
      e instanceof Error ? e.message : "Fal.ai failed",
      { provider: "fal" }
    );
  }
}

function mapAspectToFalSize(aspect?: string): string {
  switch ((aspect ?? "").toLowerCase()) {
    case "16:9":
      return "landscape_16_9";
    case "9:16":
      return "portrait_9_16";
    case "4:3":
      return "landscape_4_3";
    case "3:4":
      return "portrait_4_3";
    case "1:1":
    default:
      return "square_hd";
  }
}
