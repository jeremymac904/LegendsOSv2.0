import Link from "next/link";
import { ArrowLeft, Users2 } from "lucide-react";

import { CreateAudienceForm } from "@/components/email/CreateAudienceForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  getCurrentProfile,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import { formatRelative } from "@/lib/utils";
import type { NewsletterAudience } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function AudiencesIndexPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = getSupabaseServerClient();

  const [{ data: audiences }, { data: counts }] = await Promise.all([
    supabase
      .from("newsletter_audiences")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("newsletter_contacts")
      .select("audience_id,status"),
  ]);

  const audienceList = (audiences ?? []) as NewsletterAudience[];
  const totals = new Map<string, { total: number; active: number }>();
  for (const c of (counts ?? []) as { audience_id: string | null; status: string }[]) {
    if (!c.audience_id) continue;
    const t = totals.get(c.audience_id) ?? { total: 0, active: 0 };
    t.total += 1;
    if (c.status === "active") t.active += 1;
    totals.set(c.audience_id, t);
  }

  return (
    <div className="space-y-6">
      <Link href="/email" className="btn-ghost w-fit text-xs">
        <ArrowLeft size={14} />
        Email Studio
      </Link>
      <SectionHeader
        eyebrow="Email Audiences"
        title="Realtor newsletter lists"
        description="Import contacts from CSV, segment by name, and target newsletters at them from Email Studio."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <section className="card-padded">
          <div className="section-title">
            <div>
              <h2>Your audiences</h2>
              <p>Each audience is a named list of contacts you own.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            {audienceList.length === 0 ? (
              <EmptyState
                icon={Users2}
                title="No audiences yet"
                description="Create one on the right, then upload your CSV inside the audience."
              />
            ) : (
              audienceList.map((a) => {
                const t = totals.get(a.id) ?? { total: 0, active: 0 };
                return (
                  <Link
                    key={a.id}
                    href={`/email/audiences/${a.id}`}
                    className="flex items-start justify-between gap-3 rounded-xl border border-ink-800 bg-ink-900/40 p-3 transition hover:border-accent-gold/30"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-100">{a.name}</p>
                      {a.description && (
                        <p className="text-xs text-ink-300">{a.description}</p>
                      )}
                      <p className="mt-1 text-[11px] text-ink-300">
                        {t.total} contact{t.total === 1 ? "" : "s"} · {t.active} active
                      </p>
                    </div>
                    <div className="text-right text-[11px] text-ink-300">
                      <StatusPill
                        status={a.is_active ? "ok" : "off"}
                        label={a.is_active ? "active" : "inactive"}
                      />
                      <p className="mt-1">Updated {formatRelative(a.updated_at)}</p>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </section>
        <aside>
          <CreateAudienceForm />
          <div className="card-padded mt-4 text-[11px] text-ink-300">
            <p className="label">Realtor CSV format</p>
            <p className="mt-2">
              The importer auto-recognises columns named:
              <br />
              Full Name, First Name, Last Name, Email, Email 2, Phone, Phone 2,
              Office Phone, Office Name, City, State, State License, Facebook,
              Instagram, LinkedIn, X (Twitter), YouTube, TikTok, Zillow,
              Other Links, Transaction Count, Total Volume, Buyer Volume,
              Buyer Units.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
