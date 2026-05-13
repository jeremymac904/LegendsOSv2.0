#!/usr/bin/env node
/**
 * LegendsOS — seed Atlas assistants from local kits
 *
 * Source: future/Loan_Factory_AI_Assistants/<kit>/01_System_Instructions.md
 *         + assistant_config.json + 10_Assistant_Instructions.md
 * Sink:   public.atlas_assistants (Supabase, via service role)
 *
 * Six kits:
 *   1. Loan Factory AI Mortgage Coach        → team_shared
 *   2. Loan Factory Credit AI Assistant      → team_shared
 *   3. Loan Factory Elite LO Assistant       → team_shared
 *   4. Loan Factory Real Estate Investor     → team_shared
 *   5. Loan Factory Realtor Coach            → team_shared
 *   6. Loan Factory Marketing & Recruiting   → owner_only (Jeremy specified)
 *
 * Idempotent — re-running:
 *   - if an assistant with the same `name` and `organization_id` exists,
 *     it updates the system_prompt / description / metadata.
 *   - otherwise inserts a new row.
 */

import { createClient } from "@supabase/supabase-js";
import { config as dotenvConfig } from "dotenv";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

dotenvConfig({ path: ".env.local" });

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://eifkdkifkstkubzpzgpb.supabase.co";
const SECRET =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SECRET) {
  console.error("Missing SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SECRET, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const REPO_ROOT = resolve(process.cwd());
const KITS_DIR = join(REPO_ROOT, "future", "Loan_Factory_AI_Assistants");

interface KitMeta {
  folder: string;
  name: string;
  description: string;
  visibility: "owner_only" | "team_shared";
}

const KITS: KitMeta[] = [
  {
    folder: "Loan_Factory_AI_Mortgage_Coach_Build_Package",
    name: "Loan Factory AI Mortgage Coach",
    description:
      "Coaches loan officers and borrowers through mortgage scenarios — pre-approval, scenario shaping, structure tradeoffs.",
    visibility: "team_shared",
  },
  {
    folder: "Loan_Factory_Credit_AI_Assistant_Kit",
    name: "Loan Factory Credit AI Assistant",
    description:
      "Mortgage-safe credit improvement coaching. Score boost playbook, risk guardrails, borrower action plans.",
    visibility: "team_shared",
  },
  {
    folder: "Loan_Factory_Elite_LO_Assistant_Build_Kit",
    name: "Loan Factory Elite LO Assistant",
    description:
      "Elite loan-officer co-pilot — daily execution, lead-handling scripts, conversion playbook.",
    visibility: "team_shared",
  },
  {
    folder: "Loan_Factory_RE_Investor_Assistant_Knowledge_Pack",
    name: "Loan Factory Real Estate Investor Assistant",
    description:
      "Real-estate investor scenarios — DSCR, multi-unit deal structure, BRRRR/refi paths, loan-fit guidance.",
    visibility: "team_shared",
  },
  {
    folder: "LoanFactory_RealtorCoach",
    name: "Loan Factory Realtor Coach",
    description:
      "Realtor coaching companion — lead generation, conversion scripts, daily execution system, content engine.",
    visibility: "team_shared",
  },
  {
    folder: "Loan_Factory_Marketing_Recruiting_Assistant_UPLOAD_READY",
    name: "Loan Factory Marketing & Recruiting Assistant",
    description:
      "Marketing and recruiting copilot — outreach scaffolds, recruiter playbooks. Owner-only by request.",
    visibility: "owner_only",
  },
];

// Sibling kits sourced from outside the Loan_Factory_AI_Assistants tree.
const EXTERNAL_KITS: { rootRelative: string; meta: KitMeta }[] = [
  {
    rootRelative: "future/LoanFactory_Social_Media_Assistant_ELITE_v1",
    meta: {
      folder: "LoanFactory_Social_Media_Assistant_ELITE_v1",
      name: "Loan Factory Social Media / Content Assistant",
      description:
        "Voice-on-brand social-media and long-form content copilot — channels, content cadence, prompt library.",
      visibility: "team_shared",
    },
  },
];

function safeRead(path: string): string {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return "";
  }
}

function pickPromptFile(folderPath: string): string | null {
  // Preferred top-level candidates.
  const flat = [
    "15_Master_Assistant_Prompt.md",
    "10_Assistant_Instructions.md",
    "01_System_Instructions.md",
    "00_CUSTOM_GPT_INSTRUCTIONS.md",
    "Master_System_Instructions.md",
    "system_instructions.md",
    "README.md",
  ];
  for (const c of flat) {
    const p = join(folderPath, c);
    if (existsSync(p)) return p;
  }
  // Recursive walk — first match for *Master*Prompt* / *System*Instructions* /
  // *CUSTOM*GPT*INSTRUCTIONS* / Assistant*Instruction.
  const PATTERN =
    /master.*prompt|master.*system|system.*instruction|assistant.*instruction|custom.*gpt.*instruction/i;
  function walk(dir: string, depth = 0): string | null {
    if (depth > 3) return null;
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      return null;
    }
    // Prefer files at the current depth before descending
    for (const name of entries) {
      const full = join(dir, name);
      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }
      if (stat.isFile() && PATTERN.test(name) && /\.md$/i.test(name)) return full;
    }
    for (const name of entries) {
      if (name.startsWith(".")) continue;
      const full = join(dir, name);
      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        const found = walk(full, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }
  return walk(folderPath);
}

function loadConfig(folderPath: string): Record<string, unknown> | null {
  const cfgPath = join(folderPath, "assistant_config.json");
  if (!existsSync(cfgPath)) return null;
  try {
    return JSON.parse(safeRead(cfgPath));
  } catch {
    return null;
  }
}

async function getOrgId(): Promise<string | null> {
  const { data } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "legends-mortgage")
    .maybeSingle();
  return data?.id ?? null;
}

async function getOwnerId(): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "owner")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function upsertAssistant(
  organization_id: string,
  owner_user_id: string,
  kit: KitMeta,
  promptText: string,
  config: Record<string, unknown> | null
) {
  const meta = {
    source_kit: kit.folder,
    source_root: `future/Loan_Factory_AI_Assistants/${kit.folder}`,
    seeded_by: "scripts/seed-atlas-assistants-from-local.ts",
    seeded_at: new Date().toISOString(),
    config: config ?? null,
  };

  // Look up existing by org + name
  const { data: existing } = await supabase
    .from("atlas_assistants")
    .select("id")
    .eq("organization_id", organization_id)
    .eq("name", kit.name)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("atlas_assistants")
      .update({
        description: kit.description,
        visibility: kit.visibility,
        system_prompt: promptText,
        is_active: true,
        metadata: meta,
      })
      .eq("id", existing.id);
    if (error) throw error;
    return { id: existing.id, action: "updated" as const };
  }

  const { data: inserted, error } = await supabase
    .from("atlas_assistants")
    .insert({
      organization_id,
      owner_user_id,
      name: kit.name,
      description: kit.description,
      visibility: kit.visibility,
      system_prompt: promptText,
      is_active: true,
      metadata: meta,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: inserted!.id, action: "created" as const };
}

async function main() {
  if (!existsSync(KITS_DIR)) {
    console.error(`Kit folder not found: ${KITS_DIR}`);
    process.exit(2);
  }

  const organization_id = await getOrgId();
  const owner_user_id = await getOwnerId();
  if (!organization_id || !owner_user_id) {
    console.error("Missing organization 'legends-mortgage' or an owner profile.");
    process.exit(3);
  }

  console.log("--- seeding atlas assistants ---");
  for (const kit of KITS) {
    const folderPath = join(KITS_DIR, kit.folder);
    if (!existsSync(folderPath) || !statSync(folderPath).isDirectory()) {
      console.log(`  SKIP ${kit.name} (folder missing)`);
      continue;
    }
    const promptFile = pickPromptFile(folderPath);
    if (!promptFile) {
      console.log(`  SKIP ${kit.name} (no system-instruction file found)`);
      continue;
    }
    const promptText = safeRead(promptFile).trim();
    if (!promptText) {
      console.log(`  SKIP ${kit.name} (empty system prompt)`);
      continue;
    }
    const config = loadConfig(folderPath);
    const { action } = await upsertAssistant(
      organization_id,
      owner_user_id,
      kit,
      promptText,
      config
    );
    console.log(`  ${action.toUpperCase()} ${kit.name} (visibility=${kit.visibility}, prompt_chars=${promptText.length})`);
  }

  // External kits — same shape, but for kits that don't ship a master
  // prompt (the Elite social-media kit only has topical .md files), we
  // synthesize a system prompt from brand.md + system.md if they exist.
  for (const { rootRelative, meta } of EXTERNAL_KITS) {
    const folderPath = resolve(REPO_ROOT, rootRelative);
    if (!existsSync(folderPath) || !statSync(folderPath).isDirectory()) {
      console.log(`  SKIP ${meta.name} (folder missing)`);
      continue;
    }
    let promptText = "";
    const promptFile = pickPromptFile(folderPath);
    if (promptFile) {
      promptText = safeRead(promptFile).trim();
    } else {
      // Synthesize from common pieces of the elite social kit.
      const parts: string[] = [];
      const candidates = [
        "01_BRAND_AND_POSITIONING/brand.md",
        "03_CONTENT_STRATEGY_SYSTEM/system.md",
        "02_COMPLIANCE_AND_DO_NOT_SAY/compliance.md",
      ];
      for (const c of candidates) {
        const p = resolve(folderPath, c);
        if (existsSync(p)) {
          parts.push(`# ${c}\n\n${safeRead(p).trim()}`);
        }
      }
      if (parts.length > 0) {
        promptText = [
          `You are the ${meta.name}. Use the brand voice, content strategy,`,
          `and compliance rules below as your operating instructions.`,
          "",
          parts.join("\n\n---\n\n"),
        ].join("\n");
      }
    }
    if (!promptText) {
      console.log(`  SKIP ${meta.name} (no usable system prompt could be synthesized)`);
      continue;
    }
    const config = loadConfig(folderPath);
    const { action } = await upsertAssistant(
      organization_id,
      owner_user_id,
      meta,
      promptText,
      config
    );
    console.log(`  ${action.toUpperCase()} ${meta.name} (visibility=${meta.visibility}, prompt_chars=${promptText.length})`);
  }

  console.log("done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
