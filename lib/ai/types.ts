export type ProviderId = "openrouter" | "deepseek" | "nvidia" | "fal";

export interface ChatTurn {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatRequest {
  provider?: ProviderId;
  model?: string;
  messages: ChatTurn[];
  temperature?: number;
  max_tokens?: number;
  metadata?: Record<string, unknown>;
}

export interface ChatResponse {
  ok: true;
  provider: ProviderId;
  model: string;
  content: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  raw?: unknown;
}

export interface GatewayError {
  ok: false;
  error:
    | "provider_not_configured"
    | "provider_disabled"
    | "rate_limited"
    | "cap_exceeded"
    | "live_action_blocked"
    | "bad_request"
    | "provider_error"
    | "internal_error";
  provider?: ProviderId | string;
  message: string;
  env_var?: string;
  status?: number;
}

export type GatewayResult<T> = T | GatewayError;

export interface ImageRequest {
  provider?: ProviderId;
  model?: string;
  prompt: string;
  aspect_ratio?: string;
  metadata?: Record<string, unknown>;
}

export interface ImageResponse {
  ok: true;
  provider: ProviderId;
  model: string;
  image_url: string;
  revised_prompt?: string;
  cost_estimate?: number;
  raw?: unknown;
}
