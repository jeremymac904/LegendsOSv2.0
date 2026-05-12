import { getServerEnv } from "@/lib/env";

import type {
  ChatRequest,
  ChatResponse,
  GatewayError,
  GatewayResult,
  ImageRequest,
  ImageResponse,
  ProviderId,
} from "./types";

const SYSTEM_DEFAULT =
  "You are Atlas, the internal AI assistant for the Legends Mortgage Team powered by Loan Factory. You assist Jeremy McDonald and licensed loan officers with mortgage marketing, client education, and operational tasks. Always include the compliance line when generating outbound marketing content: 'Jeremy McDonald, NMLS 1195266, The Legends Mortgage Team powered by Loan Factory, NMLS 320841.' Refuse to provide regulated legal, tax, or financial advice that requires a licensed professional review.";

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
  const provider = (request.provider ?? "openrouter") as ProviderId;

  if (provider === "openrouter") {
    if (!env.OPENROUTER_API_KEY) {
      return err("provider_not_configured", "OpenRouter is not configured.", {
        provider,
        env_var: "OPENROUTER_API_KEY",
      });
    }
    if (!env.SAFETY.allowPaidTextGeneration) {
      return err(
        "live_action_blocked",
        "Paid text generation is disabled. Set ALLOW_PAID_TEXT_GENERATION=true once Jeremy approves billing.",
        { provider }
      );
    }
    return openrouterChat(request, env.OPENROUTER_API_KEY, request.model ?? env.OPENROUTER_DEFAULT_MODEL);
  }

  if (provider === "deepseek") {
    if (!env.DEEPSEEK_API_KEY) {
      return err("provider_not_configured", "DeepSeek is not configured.", {
        provider,
        env_var: "DEEPSEEK_API_KEY",
      });
    }
    if (!env.SAFETY.allowPaidTextGeneration) {
      return err(
        "live_action_blocked",
        "Paid text generation is disabled. Set ALLOW_PAID_TEXT_GENERATION=true once Jeremy approves billing.",
        { provider }
      );
    }
    return deepseekChat(request, env.DEEPSEEK_API_KEY, request.model ?? env.DEEPSEEK_DEFAULT_MODEL);
  }

  if (provider === "nvidia") {
    if (!env.NVIDIA_API_KEY) {
      return err("provider_not_configured", "NVIDIA is not configured.", {
        provider,
        env_var: "NVIDIA_API_KEY",
      });
    }
    if (!env.SAFETY.allowPaidTextGeneration) {
      return err(
        "live_action_blocked",
        "Paid text generation is disabled. Set ALLOW_PAID_TEXT_GENERATION=true once Jeremy approves billing.",
        { provider }
      );
    }
    return nvidiaChat(
      request,
      env.NVIDIA_API_KEY,
      request.model ?? "meta/llama-3.1-70b-instruct"
    );
  }

  return err("bad_request", `Provider ${provider} is not supported for chat.`, {
    provider,
  });
}

async function openrouterChat(
  request: ChatRequest,
  apiKey: string,
  model: string
): Promise<GatewayResult<ChatResponse>> {
  const messages = ensureSystem(request.messages);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://legendsos.app",
        "X-Title": "LegendsOS 2.0",
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
      return err("provider_error", `OpenRouter ${res.status}: ${text.slice(0, 400)}`, {
        provider: "openrouter",
        status: res.status,
      });
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
  model: string
): Promise<GatewayResult<ChatResponse>> {
  const messages = ensureSystem(request.messages);
  try {
    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
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
      return err("provider_error", `DeepSeek ${res.status}: ${text.slice(0, 400)}`, {
        provider: "deepseek",
        status: res.status,
      });
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
    return err("internal_error", e instanceof Error ? e.message : "DeepSeek failed", {
      provider: "deepseek",
    });
  }
}

async function nvidiaChat(
  request: ChatRequest,
  apiKey: string,
  model: string
): Promise<GatewayResult<ChatResponse>> {
  const messages = ensureSystem(request.messages);
  try {
    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
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
      return err("provider_error", `NVIDIA ${res.status}: ${text.slice(0, 400)}`, {
        provider: "nvidia",
        status: res.status,
      });
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
    return err("internal_error", e instanceof Error ? e.message : "NVIDIA failed", {
      provider: "nvidia",
    });
  }
}

function ensureSystem(messages: ChatRequest["messages"]) {
  if (messages.length === 0 || messages[0].role !== "system") {
    return [{ role: "system" as const, content: SYSTEM_DEFAULT }, ...messages];
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

  if (!env.FAL_KEY) {
    return err("provider_not_configured", "Fal.ai is not configured.", {
      provider: "fal",
      env_var: "FAL_KEY",
    });
  }
  if (!env.SAFETY.allowPaidImageGeneration) {
    return err(
      "live_action_blocked",
      "Paid image generation is disabled. Set ALLOW_PAID_IMAGE_GENERATION=true once Jeremy approves billing.",
      { provider: "fal" }
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
      return err("provider_error", `Fal.ai ${res.status}: ${text.slice(0, 400)}`, {
        provider: "fal",
        status: res.status,
      });
    }
    const json = (await res.json()) as {
      images?: { url: string }[];
      image?: { url: string };
    };
    const url = json.images?.[0]?.url ?? json.image?.url ?? "";
    if (!url) {
      return err("provider_error", "Fal.ai returned no image URL.", { provider: "fal" });
    }
    return {
      ok: true,
      provider: "fal",
      model,
      image_url: url,
      cost_estimate: 0.01,
    };
  } catch (e) {
    return err("internal_error", e instanceof Error ? e.message : "Fal.ai failed", {
      provider: "fal",
    });
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
