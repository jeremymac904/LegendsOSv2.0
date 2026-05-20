// Atlas planner — LLM-driven tool-call planner.
//
// Input: the user's latest message, prior chat turns, a persona summary, a
// knowledge context block, and the tool manifest (each tool's id, name,
// description, and a JSON-Schema fragment derived from its zod schema).
//
// Output: { tool, input, confidence, rationale } — strict JSON. Failures
// (provider unconfigured, JSON parse, schema validation) fall back to chat
// silently — the chat route reads `needsChatFallback` and routes accordingly.
//
// Why this is separate from the regex matcher in intentDetection.ts: the
// regex matcher is the FAST PATH for the highest-traffic verbs (draft, write,
// schedule, save a note, what can you do). The planner is the FALLBACK for
// everything the regex doesn't catch — e.g. "give me an Instagram caption
// for my new VA-loan grad clients", "make a calendar event titled 'review
// rate sheet' on Friday morning", "what's wired up?". Both paths route to
// the same registry handlers.

import { z } from "zod";

import { runChat } from "@/lib/ai/providers";
import { TOOLS, type ToolEntry } from "@/lib/atlas/registry";
import {
  personaFor,
  personaSystemPromptAddendum,
  type AtlasPersona,
} from "@/lib/atlas/persona";
import type { Profile } from "@/types/database";

// Confidence threshold below which we ignore the planner and fall through to
// normal chat. Keep this high enough that wrong tool calls are rare; the
// regex matcher already catches everything obvious.
const PLANNER_CONFIDENCE_THRESHOLD = 0.7;

export interface PlannerInput {
  profile: Profile;
  message: string;
  history: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  // Knowledge context block from buildKnowledgeContext (may be empty).
  knowledge_block: string;
  // Override the provider used by the planner. Otherwise uses the default.
  provider?: "openrouter" | "deepseek" | "nvidia";
  model?: string;
}

export interface PlannerOutput {
  tool_id: string | null;
  input: Record<string, unknown> | null;
  confidence: number;
  rationale: string;
  needs_chat_fallback: boolean;
  // Filled when the planner failed silently (provider unconfigured, JSON
  // parse error, schema validation rejected). Useful for analytics, NOT
  // surfaced to the user.
  failure_reason: string | null;
}

// Build a JSON-Schema-ish fragment from a tool's zod schema. We don't need
// full JSON-Schema — only enough for the planner LLM to read field names +
// types + required flags. We do this manually rather than pulling in
// `zod-to-json-schema` (an extra dependency) to keep the build slim.
function toolFieldsFromSchema(entry: ToolEntry): string {
  const def = (entry.inputSchema as z.ZodTypeAny)._def;
  if (def?.typeName !== "ZodObject") {
    return "(no fields)";
  }
  const shape: Record<string, z.ZodTypeAny> = (entry.inputSchema as z.ZodObject<z.ZodRawShape>).shape;
  const lines: string[] = [];
  for (const [key, schema] of Object.entries(shape)) {
    const inner = unwrap(schema);
    const typeLabel = labelFor(inner);
    const required = !isOptional(schema);
    lines.push(`    - ${key} (${typeLabel}${required ? ", required" : ""})`);
  }
  return lines.length > 0 ? lines.join("\n") : "(no fields)";
}

// zod-def helpers. Zod's internal `_def` shape is not public, so we cast
// through `unknown` once and treat the rest as a loose record. This keeps
// the lint config (which doesn't load @typescript-eslint) happy without
// suppressing rules.
type ZodDef = {
  typeName?: string;
  innerType?: z.ZodTypeAny;
  type?: z.ZodTypeAny;
  values?: string[];
  value?: unknown;
};

function defOf(schema: z.ZodTypeAny): ZodDef | null {
  const raw = (schema as unknown as { _def?: unknown })._def;
  if (!raw || typeof raw !== "object") return null;
  return raw as ZodDef;
}

function unwrap(schema: z.ZodTypeAny): z.ZodTypeAny {
  let s: z.ZodTypeAny = schema;
  while (true) {
    const def = defOf(s);
    if (!def) break;
    if (
      (def.typeName === "ZodOptional" ||
        def.typeName === "ZodNullable" ||
        def.typeName === "ZodDefault") &&
      def.innerType
    ) {
      s = def.innerType;
      continue;
    }
    break;
  }
  return s;
}

function isOptional(schema: z.ZodTypeAny): boolean {
  const def = defOf(schema);
  if (!def) return false;
  return (
    def.typeName === "ZodOptional" ||
    def.typeName === "ZodNullable" ||
    def.typeName === "ZodDefault"
  );
}

function labelFor(schema: z.ZodTypeAny): string {
  const def = defOf(schema);
  if (!def?.typeName) return "unknown";
  switch (def.typeName) {
    case "ZodString":
      return "string";
    case "ZodNumber":
      return "number";
    case "ZodBoolean":
      return "boolean";
    case "ZodArray":
      return `array<${def.type ? labelFor(def.type) : "unknown"}>`;
    case "ZodEnum":
      return `enum<${(def.values ?? []).join("|")}>`;
    case "ZodObject":
      return "object";
    case "ZodLiteral":
      return `literal<${JSON.stringify(def.value)}>`;
    default:
      return def.typeName.replace(/^Zod/, "").toLowerCase();
  }
}

function buildToolManifestText(rolesAllowed: string): string {
  return TOOLS.filter((t) => t.rolesAllowed.includes(rolesAllowed as never))
    .map((t) => {
      return [
        `- ${t.id}: ${t.description}`,
        `  fields:`,
        toolFieldsFromSchema(t),
      ].join("\n");
    })
    .join("\n");
}

function plannerSystemPrompt(persona: AtlasPersona, manifest: string): string {
  return [
    "You are Atlas's tool planner.",
    "Decide whether the user's latest message should be routed to a tool from the list below, or to plain chat.",
    "",
    "Persona context:",
    personaSystemPromptAddendum(persona),
    "",
    "Rules:",
    "- Reply with STRICT JSON only. No prose, no markdown, no code fences.",
    "- Shape: { \"tool\": <id|null>, \"input\": <object|null>, \"confidence\": <0..1>, \"rationale\": <one short line> }.",
    "- Never invent a tool not in the list. Never invent fields not declared on the tool.",
    "- For draft / write tools, set status='draft' implicitly — you never publish, post, or send.",
    "- If you can't pick a tool with confidence >= 0.7, set tool=null so we fall through to normal chat.",
    "",
    "Available tools:",
    manifest,
  ].join("\n");
}

// Wraps the LLM call. Returns null on any failure so the chat route can
// silently fall through.
async function callPlannerLLM(args: {
  provider?: PlannerInput["provider"];
  model?: PlannerInput["model"];
  systemPrompt: string;
  message: string;
  history: PlannerInput["history"];
  knowledge_block: string;
}): Promise<{ content: string } | null> {
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: args.systemPrompt },
  ];
  // Trim history to last 6 turns so the planner stays cheap.
  const trimmed = args.history.slice(-6).map((m) => ({
    role: (m.role === "system" ? "assistant" : m.role) as
      | "user"
      | "assistant"
      | "system",
    content: m.content,
  }));
  messages.push(...trimmed);
  if (args.knowledge_block) {
    messages.push({
      role: "system",
      content: `Knowledge context (use for routing only, never invent):\n${args.knowledge_block}`,
    });
  }
  messages.push({ role: "user", content: args.message });

  try {
    const res = await runChat({
      provider: args.provider,
      model: args.model,
      messages,
      temperature: 0.1,
      max_tokens: 350,
    });
    if (!("ok" in res) || res.ok !== true) return null;
    return { content: res.content };
  } catch {
    return null;
  }
}

const plannerJsonSchema = z.object({
  tool: z.string().nullable().optional(),
  input: z.record(z.unknown()).nullable().optional(),
  confidence: z.number().min(0).max(1).optional(),
  rationale: z.string().max(400).optional(),
});

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  // Strip code fences if the model returned them despite instructions.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const body = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(body);
  } catch {
    // Try the first `{...}` block.
    const m = body.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function planAtlasTool(input: PlannerInput): Promise<PlannerOutput> {
  const persona = personaFor(input.profile);
  const manifest = buildToolManifestText(input.profile.role);
  const systemPrompt = plannerSystemPrompt(persona, manifest);

  const llmRes = await callPlannerLLM({
    provider: input.provider,
    model: input.model,
    systemPrompt,
    message: input.message,
    history: input.history,
    knowledge_block: input.knowledge_block,
  });
  if (!llmRes) {
    return {
      tool_id: null,
      input: null,
      confidence: 0,
      rationale: "",
      needs_chat_fallback: true,
      failure_reason: "planner_provider_failed",
    };
  }

  const parsed = extractJson(llmRes.content);
  if (parsed === null) {
    return {
      tool_id: null,
      input: null,
      confidence: 0,
      rationale: "",
      needs_chat_fallback: true,
      failure_reason: "planner_json_parse_failed",
    };
  }

  const validated = plannerJsonSchema.safeParse(parsed);
  if (!validated.success) {
    return {
      tool_id: null,
      input: null,
      confidence: 0,
      rationale: "",
      needs_chat_fallback: true,
      failure_reason: "planner_schema_invalid",
    };
  }

  const toolId = validated.data.tool ?? null;
  const confidence = validated.data.confidence ?? 0;
  const rationale = validated.data.rationale ?? "";
  if (!toolId || toolId === "null") {
    return {
      tool_id: null,
      input: null,
      confidence,
      rationale,
      needs_chat_fallback: true,
      failure_reason: null,
    };
  }

  // Validate the tool exists + caller is allowed.
  const entry = TOOLS.find((t) => t.id === toolId);
  if (!entry) {
    return {
      tool_id: null,
      input: null,
      confidence,
      rationale,
      needs_chat_fallback: true,
      failure_reason: "planner_unknown_tool",
    };
  }
  if (!entry.rolesAllowed.includes(input.profile.role as never)) {
    return {
      tool_id: null,
      input: null,
      confidence,
      rationale,
      needs_chat_fallback: true,
      failure_reason: "planner_role_not_allowed",
    };
  }

  if (confidence < PLANNER_CONFIDENCE_THRESHOLD) {
    return {
      tool_id: null,
      input: null,
      confidence,
      rationale,
      needs_chat_fallback: true,
      failure_reason: null,
    };
  }

  return {
    tool_id: toolId,
    input: (validated.data.input ?? {}) as Record<string, unknown>,
    confidence,
    rationale,
    needs_chat_fallback: false,
    failure_reason: null,
  };
}

export const PLANNER_CONFIDENCE_THRESHOLD_VALUE = PLANNER_CONFIDENCE_THRESHOLD;
