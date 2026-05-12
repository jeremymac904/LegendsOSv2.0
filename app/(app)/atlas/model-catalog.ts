import type { getServerEnv } from "@/lib/env";

type ServerEnv = ReturnType<typeof getServerEnv>;

// Single source of truth for the model dropdown content. Used by /atlas and
// /atlas/[threadId] so they don't have to duplicate the same long list of
// optional model env values.
export function buildAtlasModelCatalog(env: ServerEnv) {
  return {
    openrouter: env.OPENROUTER_API_KEY
      ? [
          {
            id: env.OPENROUTER_DEFAULT_MODEL,
            label: `default — ${env.OPENROUTER_DEFAULT_MODEL}`,
          },
          ...env.OPENROUTER_FREE_MODELS.map((m) => ({
            id: m,
            label: `free — ${m}`,
          })),
        ]
      : [],
    deepseek: env.DEEPSEEK_API_KEY
      ? [
          {
            id: env.DEEPSEEK_DEFAULT_MODEL,
            label: `default — ${env.DEEPSEEK_DEFAULT_MODEL}`,
          },
        ]
      : [],
    nvidia: env.NVIDIA_API_KEY
      ? [
          env.NVIDIA_MODELS.kimi_k2_5
            ? {
                id: env.NVIDIA_MODELS.kimi_k2_5,
                label: `Kimi K2 5 — ${env.NVIDIA_MODELS.kimi_k2_5}`,
              }
            : null,
          env.NVIDIA_MODELS.nemotron_super_120b
            ? {
                id: env.NVIDIA_MODELS.nemotron_super_120b,
                label: `Nemotron Super 120B — ${env.NVIDIA_MODELS.nemotron_super_120b}`,
              }
            : null,
          env.NVIDIA_MODELS.mistral_small_4_119b
            ? {
                id: env.NVIDIA_MODELS.mistral_small_4_119b,
                label: `Mistral Small 4 119B — ${env.NVIDIA_MODELS.mistral_small_4_119b}`,
              }
            : null,
        ].filter((m): m is { id: string; label: string } => m !== null)
      : [],
  };
}
