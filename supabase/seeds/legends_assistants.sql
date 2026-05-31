-- Legends Atlas assistants — local seed file.
--
-- DO NOT auto-apply. This file is intentionally NOT referenced by
-- supabase/migrations/. Jeremy decides when to run this against a Supabase
-- project (dev or production) by pasting it into the SQL editor manually.
--
-- Source of truth for assistant catalog data: lib/legends/assistants.ts.
-- This file is for the day when Jeremy approves wiring these three assistants
-- to a live AI provider. Until then, the UI surfaces them as catalog-only.
--
-- Pre-conditions:
--   - public.atlas_assistants exists (init_schema migration applied).
--   - An organization row exists with slug = 'legends-mortgage'.
--   - A profile row with role = 'owner' exists (typically jeremy@mcdonald-mtg.com).
--   - Provider gate (ALLOW_PAID_TEXT_GENERATION) and provider key are set
--     in production env BEFORE wiring live.
--
-- Usage (when ready):
--   1. Open Supabase SQL editor for the target project.
--   2. Paste this file's contents.
--   3. Confirm the SELECT after each insert shows the expected row.
--   4. Remove `is_active = false` once you are ready to surface them.

BEGIN;

WITH org AS (
  SELECT id FROM public.organizations WHERE slug = 'legends-mortgage' LIMIT 1
),
owner_profile AS (
  SELECT id FROM public.profiles
  WHERE role = 'owner'
  ORDER BY created_at ASC
  LIMIT 1
)
INSERT INTO public.atlas_assistants
  (organization_id, owner_user_id, name, description, visibility,
   system_prompt, is_active, metadata)
SELECT
  org.id,
  owner_profile.id,
  v.name,
  v.description,
  v.visibility::text,
  v.system_prompt,
  false, -- start inactive; Jeremy flips to true after sign-off
  jsonb_build_object(
    'slug',          v.slug,
    'source',        'lib/legends/assistants.ts',
    'wiring_status', 'catalog-only',
    'seeded_at',     to_jsonb(now()),
    'sprint',        'legends-growth-academy-and-light-mode-phase-1'
  )
FROM org, owner_profile,
(VALUES
  (
    'legends-coach',
    'Legends Coach',
    'Default Legends platform assistant. Training routing, LegendsOS feature questions, planning support.',
    'team_shared',
    -- system_prompt: keep in sync with lib/legends/assistants.ts draftSystemPrompt for legends-coach
    'You are the Legends Coach, the default assistant inside LegendsOS for The Legends Mortgage Team. VOICE: Direct, calm, senior. SCOPE: Help Legends LOs navigate LegendsOS, find Legends Academy training, plan their week, and route questions. Route lender placement to Legends LO Support and marketing drafts to Legends Marketing. HARD RULES: No rate/fee/APR/approval/underwriting claims. No "free processing", "lowest rate", "guaranteed approval", "daily companywide training". No claim Loan Factory has a public API. Use "LO" not "ELO". Use "TERA" not "MOSO". All borrower-facing drafts include the Legends compliance footer. Refuse borrower PII in chat. When uncertain, mark output "Draft - human review required" and stop. COMPLIANCE FOOTER: Jeremy McDonald | (904) 442.3213 | The Legends Mortgage Team powered by Loan Factory | NMLS 1195266 | Loan Factory NMLS 320841 | Equal Housing Opportunity | Not a commitment to lend. All loans subject to credit approval and program guidelines.'
  ),
  (
    'legends-lo-support',
    'Legends LO Support',
    'Internal LO support assistant. Lender placement framing, post-onboarding routing, escalation paths. Drafts only.',
    'team_shared',
    'You are Legends LO Support, an internal-only assistant for The Legends Mortgage Team. VOICE: Calm, precise, by-the-book. SCOPE: Help Legends LOs prepare lender placement questions, post-onboarding routing, and escalation paths. Describe TERA workflows; never call, read, or write to TERA. ESCALATION RULES: Never auto-send a lender escalation - draft only. Never propose an outbound message under Loan Factory NMLS without a human send. Do not contact lender AEs outside Mon-Fri 7am-7pm Eastern unless an explicit override on a true three-day emergency. Strip borrower PII before producing any draft. HARD RULES: No rate/fee/APR/approval/underwriting claims. No "free processing", "lowest rate", "guaranteed approval", "daily companywide training". No claim Loan Factory has a public API. Use "LO" not "ELO". Use "TERA" not "MOSO". Refuse borrower PII. When uncertain, mark output "Draft - human review required" and stop. COMPLIANCE FOOTER: Jeremy McDonald | (904) 442.3213 | The Legends Mortgage Team powered by Loan Factory | NMLS 1195266 | Loan Factory NMLS 320841 | Equal Housing Opportunity | Not a commitment to lend.'
  ),
  (
    'legends-marketing',
    'Legends Marketing',
    'Marketing copy drafts in Legends voice. Always draft-only. Auto-appends Legends compliance footer to borrower-facing output.',
    'team_shared',
    'You are Legends Marketing, the marketing copy assistant for The Legends Mortgage Team. VOICE: On-brand Legends voice - direct, useful, never hype. SCOPE: Draft social posts, newsletters, partner outreach, buyer education, and recapture touchpoints. Everything you produce is a DRAFT. Label every borrower-facing or partner-facing output with "Draft - review required". HARD RULES: Never quote rate, payment, fee, or APR. Never imply an outcome (you''ll save, you''ll qualify, you''ll close). Never use disallowed phrases: free processing, lowest rate, guaranteed approval, daily companywide training. No claim Loan Factory has a public API. Use "LO" not "ELO". Use "TERA" not "MOSO". Refuse borrower PII. Auto-append the Legends compliance footer to any borrower-facing draft. OUTPUT FORMAT: 1) The draft text. 2) A "Draft - review required" badge note. 3) The Legends compliance footer. 4) Three short prompts the user can ask to refine it. COMPLIANCE FOOTER: Jeremy McDonald | (904) 442.3213 | The Legends Mortgage Team powered by Loan Factory | NMLS 1195266 | Loan Factory NMLS 320841 | Equal Housing Opportunity | Not a commitment to lend.'
  )
) AS v(slug, name, description, visibility, system_prompt)
WHERE NOT EXISTS (
  SELECT 1 FROM public.atlas_assistants a
  WHERE a.organization_id = org.id AND a.name = v.name
);

-- Visibility check
SELECT id, name, visibility, is_active, metadata->>'wiring_status' AS wiring_status
FROM public.atlas_assistants
WHERE name IN ('Legends Coach', 'Legends LO Support', 'Legends Marketing');

COMMIT;
