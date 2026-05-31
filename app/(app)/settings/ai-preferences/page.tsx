import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";

import { AiPreferencesForm } from "@/components/settings/AiPreferencesForm";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { getEffectiveProfile } from "@/lib/impersonation";

export const dynamic = "force-dynamic";

// Per-user AI voice / communication preferences. Any signed-in user manages
// THEIR own row (owners/admins included). RLS — and the API route always
// stamping user_id — keep edits scoped to the caller, so no extra role gate is
// needed beyond "must be signed in".
export default async function AiPreferencesPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Settings · AI"
        title="AI preferences"
        description="How the assistant writes and acts on your behalf — your voice, communication rules, signature, and whether outbound actions need your approval. These apply to you only."
        action={
          <span className="chip">
            <Sparkles size={14} /> {profile.email}
          </span>
        }
      />

      <section className="rounded-2xl border border-ink-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-950/40">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-semibold text-ink-900 dark:text-ink-100">
              Your voice &amp; communication
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-600 dark:text-ink-300">
              Pick a preset operator voice or write your own. The assistant uses
              this when drafting loan answers, emails, and texts.
            </p>
          </div>
          <StatusPill status="info" label="personal" />
        </div>

        <AiPreferencesForm />
      </section>

      <p className="text-[12px] leading-relaxed text-ink-600 dark:text-ink-300">
        Safety note: the assistant always attempts retrieval before answering
        loan questions and never marks a loan clear-to-close, closed, denied,
        suspended, or dead without source evidence. With approval required on,
        it drafts and waits — it does not send anything on its own.
      </p>
    </div>
  );
}
