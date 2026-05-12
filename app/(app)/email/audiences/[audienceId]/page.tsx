import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, MapPin, Users2 } from "lucide-react";

import { AudienceImportPanel } from "@/components/email/AudienceImportPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatCard } from "@/components/ui/StatCard";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  getCurrentProfile,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import { formatRelative, truncate } from "@/lib/utils";
import type {
  NewsletterAudience,
  NewsletterContact,
  NewsletterContactImport,
} from "@/types/database";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { audienceId: string };
}

export default async function AudienceDetailPage({ params }: PageProps) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = getSupabaseServerClient();

  const [{ data: audience }, { data: imports }, { data: contacts }] =
    await Promise.all([
      supabase
        .from("newsletter_audiences")
        .select("*")
        .eq("id", params.audienceId)
        .maybeSingle(),
      supabase
        .from("newsletter_contact_imports")
        .select("*")
        .eq("audience_id", params.audienceId)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("newsletter_contacts")
        .select("id,email,full_name,office_name,city,state,status,created_at")
        .eq("audience_id", params.audienceId)
        .order("created_at", { ascending: false })
        .limit(2000),
    ]);

  if (!audience) notFound();

  const contactRows = (contacts ?? []) as Pick<
    NewsletterContact,
    "id" | "email" | "full_name" | "office_name" | "city" | "state" | "status" | "created_at"
  >[];
  const importRows = (imports ?? []) as NewsletterContactImport[];

  const total = contactRows.length;
  const active = contactRows.filter((c) => c.status === "active").length;
  const unsubscribed = contactRows.filter((c) => c.status === "unsubscribed").length;
  const missingEmail = contactRows.filter((c) => !c.email).length;

  function topN(getter: (c: typeof contactRows[number]) => string | null, n = 5) {
    const counts = new Map<string, number>();
    for (const c of contactRows) {
      const v = getter(c);
      if (!v) continue;
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n);
  }
  const topCities = topN((c) => (c.city ? `${c.city}${c.state ? `, ${c.state}` : ""}` : null));
  const topOffices = topN((c) => c.office_name);

  return (
    <div className="space-y-6">
      <Link href="/email/audiences" className="btn-ghost w-fit text-xs">
        <ArrowLeft size={14} />
        Audiences
      </Link>
      <SectionHeader
        eyebrow="Audience"
        title={(audience as NewsletterAudience).name}
        description={(audience as NewsletterAudience).description ?? ""}
        action={
          <StatusPill
            status={(audience as NewsletterAudience).is_active ? "ok" : "off"}
            label={(audience as NewsletterAudience).is_active ? "active" : "inactive"}
          />
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total contacts" value={total} icon={Users2} />
        <StatCard label="Active" value={active} hint="status=active" />
        <StatCard label="Unsubscribed" value={unsubscribed} hint="status=unsubscribed" />
        <StatCard label="Missing email" value={missingEmail} hint="will be skipped" />
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
        <AudienceImportPanel
          audienceId={params.audienceId}
          imports={importRows}
        />

        <div className="space-y-4">
          <section className="card-padded">
            <div className="section-title">
              <div>
                <h2 className="flex items-center gap-1">
                  <MapPin size={13} className="text-accent-gold" />
                  Top cities
                </h2>
                <p>Where the most contacts live.</p>
              </div>
            </div>
            <ul className="mt-3 space-y-1 text-xs">
              {topCities.length === 0 ? (
                <li className="text-ink-300">No city data yet.</li>
              ) : (
                topCities.map(([city, n]) => (
                  <li
                    key={city}
                    className="flex items-center justify-between rounded-md border border-ink-800 bg-ink-900/40 px-2 py-1"
                  >
                    <span className="truncate text-ink-100">{city}</span>
                    <span className="text-ink-300">{n}</span>
                  </li>
                ))
              )}
            </ul>
          </section>
          <section className="card-padded">
            <div className="section-title">
              <div>
                <h2 className="flex items-center gap-1">
                  <Building2 size={13} className="text-accent-gold" />
                  Top offices
                </h2>
                <p>Most-represented brokerages.</p>
              </div>
            </div>
            <ul className="mt-3 space-y-1 text-xs">
              {topOffices.length === 0 ? (
                <li className="text-ink-300">No office data yet.</li>
              ) : (
                topOffices.map(([office, n]) => (
                  <li
                    key={office}
                    className="flex items-center justify-between rounded-md border border-ink-800 bg-ink-900/40 px-2 py-1"
                  >
                    <span className="truncate text-ink-100">{office}</span>
                    <span className="text-ink-300">{n}</span>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      </div>

      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Contacts</h2>
            <p>Showing up to 25 most recent. Total stored: {total}.</p>
          </div>
        </div>
        <div className="mt-3 overflow-hidden rounded-xl border border-ink-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-ink-900/70 text-[10px] uppercase tracking-[0.18em] text-ink-300">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Office</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Added</th>
              </tr>
            </thead>
            <tbody>
              {contactRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-ink-300">
                    <EmptyState
                      icon={Users2}
                      title="No contacts yet"
                      description="Upload a CSV using the panel above."
                    />
                  </td>
                </tr>
              ) : (
                contactRows.slice(0, 25).map((c) => (
                  <tr key={c.id} className="border-t border-ink-800">
                    <td className="px-3 py-2 text-ink-100">
                      {c.full_name ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-ink-300">{c.email ?? "—"}</td>
                    <td className="px-3 py-2 text-ink-300">
                      {truncate(c.office_name ?? "—", 28)}
                    </td>
                    <td className="px-3 py-2 text-ink-300">
                      {c.city ? `${c.city}${c.state ? `, ${c.state}` : ""}` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill status={c.status as never} />
                    </td>
                    <td className="px-3 py-2 text-ink-300">
                      {formatRelative(c.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
