import { StatusPill } from "@/components/ui/StatusPill";

// Sprint 4 — Lane 5. Informational route-ownership matrix (owner/admin only).
//
// HONESTY: this panel ACTIVATES NOTHING. It documents which route SHOULD own
// each capability and the recommended spine. Social publishing is now
// Zapier-first; direct platform APIs stay optional advanced paths. Every "current
// status" reflects the truth today: none of these send/publish paths are
// activated. It is a planning reference, not a control surface.

type Spine = "n8n spine" | "Direct API" | "Zapier MCP";
type Status = "none activated" | "setup needed" | "disabled" | "deferred";

interface AuditRow {
  capability: string;
  // The route/module that SHOULD own this capability when it is built.
  recommendedOwner: string;
  spine: Spine;
  status: Status;
  // Why this recommendation, grounded in the audit doc.
  rationale: string;
}

const ROWS: AuditRow[] = [
  {
    capability: "Gmail intake",
    recommendedOwner: "/api/webhooks/email-intake → Direct Gmail API",
    spine: "Direct API",
    status: "deferred",
    rationale:
      "Borrower-adjacent PII must never transit a third-party automation vendor. Intake is half-built and dormant; tokens stay server-side.",
  },
  {
    capability: "Drive filing",
    recommendedOwner: "/api/knowledge + driveStatus → Direct Drive API",
    spine: "Direct API",
    status: "setup needed",
    rationale:
      "Drive helper enforces read-only intent and presence-not-values today. Live reads return false until OAuth + approval land.",
  },
  {
    capability: "Social publishing (FB/IG)",
    recommendedOwner: "Social Studio → Zapier MCP → Facebook / Instagram Zaps",
    spine: "Zapier MCP",
    status: "disabled",
    rationale:
      "Recommended path is Zapier for fastest setup and highest reliability. Direct Meta remains optional advanced API publishing.",
  },
  {
    capability: "Google Business Profile",
    recommendedOwner: "Social Studio → Zapier MCP → GBP Zap",
    spine: "Zapier MCP",
    status: "disabled",
    rationale:
      "Google Social API destination discovery is optional. Recommended path is Zapier -> Google Business Profile with no global destination id.",
  },
  {
    capability: "YouTube posting",
    recommendedOwner: "Social Studio → Zapier MCP → YouTube Zap",
    spine: "Zapier MCP",
    status: "disabled",
    rationale:
      "YouTube direct API channel selection is optional advanced setup. Recommended path is Zapier -> YouTube.",
  },
  {
    capability: "Alerts",
    recommendedOwner: "/api/automation/callback → n8n (status sink)",
    spine: "n8n spine",
    status: "none activated",
    rationale:
      "Inbound callback is HMAC fail-closed and is a status sink only — it dispatches nothing. No alert workflow is wired.",
  },
  {
    capability: "Follow-ups",
    recommendedOwner: "Atlas + n8n enqueue (queue-only)",
    spine: "n8n spine",
    status: "none activated",
    rationale:
      "enqueueAutomationJob is queue-only unless dispatch:true AND a webhook URL exist. Neither is configured; nothing sends.",
  },
];

function spinePill(spine: Spine) {
  if (spine === "Direct API")
    return { tone: "info" as const, label: "Direct API" };
  if (spine === "Zapier MCP")
    return { tone: "info" as const, label: "Zapier MCP" };
  return { tone: "info" as const, label: "n8n spine" };
}

function statusPill(status: Status) {
  // All states are honestly "not live". We never show green here.
  switch (status) {
    case "setup needed":
      return { tone: "warn" as const, label: "setup needed" };
    case "disabled":
      return { tone: "off" as const, label: "disabled" };
    case "deferred":
      return { tone: "off" as const, label: "deferred" };
    default:
      return { tone: "warn" as const, label: "none activated" };
  }
}

export function RouteOwnershipAudit() {
  return (
    <section className="card-padded">
      <div className="section-title">
        <div>
          <h2>Route ownership audit</h2>
          <p>
            Which route <em>should</em> own each capability and the recommended
            spine — updated for the Zapier-first social publishing pivot. This panel is
            informational and activates nothing. Every send/publish path is off
            today.
          </p>
        </div>
        <StatusPill status="off" label="nothing activated" />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-accent-champagne/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-100 text-[10px] uppercase tracking-[0.18em] text-ink-600 dark:bg-ink-950/50 dark:text-ink-300">
            <tr>
              <th className="px-3 py-2">Capability</th>
              <th className="px-3 py-2">Recommended owner (route)</th>
              <th className="px-3 py-2">Spine</th>
              <th className="px-3 py-2">Current status</th>
              <th className="px-3 py-2">Why</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
              const sp = spinePill(row.spine);
              const st = statusPill(row.status);
              return (
                <tr
                  key={row.capability}
                  className="border-t border-accent-champagne/10 align-top"
                >
                  <td className="px-3 py-2 font-medium text-ink-900 dark:text-ink-100">
                    {row.capability}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-ink-700 dark:text-ink-300">
                    {row.recommendedOwner}
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill status={sp.tone} label={sp.label} />
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill status={st.tone} label={st.label} />
                  </td>
                  <td className="px-3 py-2 text-[11px] leading-relaxed text-ink-600 dark:text-ink-400">
                    {row.rationale}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-ink-600 dark:text-ink-400">
      Recommendation summary: Zapier MCP is the primary social publishing
      layer for Facebook, Instagram, YouTube, TikTok, Google Business Profile,
      and LinkedIn. Direct platform APIs remain advanced optional paths.
      Borrower-adjacent Gmail, Drive, and loan data stay on direct APIs.
      </p>
    </section>
  );
}
