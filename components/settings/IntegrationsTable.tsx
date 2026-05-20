// Settings → Integrations table — full connector snapshot the user is
// permitted to see. Owner sees L1 + L2; non-owner LO sees only their own L2
// rows plus L1 status as read-only (no toggle).
//
// HARD RULES:
//   * Never render env var VALUES. Only NAMES — and only when status is
//     `not_configured` (so the user knows what to set).
//   * Never render auth tokens. We accept a boolean `hasToken` per row.
//   * No add/edit modal here — the existing MCPConnections component
//     already handles add/delete for L2 rows. This table is read-only
//     status surface.

import type { McpConnectorSnapshot } from "@/lib/mcp/types";

export interface IntegrationsTableProps {
  connectors: McpConnectorSnapshot;
  /** True for owner — used to mark "Owner-controlled" copy in the footer. */
  isOwner: boolean;
}

function statusPillClass(status: string): string {
  switch (status) {
    case "connected":
      return "bg-status-ok/10 text-status-ok border-status-ok/30";
    case "disabled":
      return "bg-status-warn/10 text-status-warn border-status-warn/30";
    case "not_configured":
    default:
      return "bg-ink-800 text-ink-300 border-ink-700";
  }
}

function statusDot(status: string): string {
  switch (status) {
    case "connected":
      return "bg-status-ok";
    case "disabled":
      return "bg-status-warn";
    case "not_configured":
    default:
      return "bg-ink-600";
  }
}

function scopeBadge(scope: string): string {
  switch (scope) {
    case "owner_global":
      return "Owner";
    case "lo_personal":
      return "Personal";
    case "future":
    default:
      return "Reserved";
  }
}

export function IntegrationsTable({
  connectors,
  isOwner,
}: IntegrationsTableProps) {
  return (
    <section id="integrations" className="card-padded">
      <div className="section-title">
        <div>
          <h2>Integrations</h2>
          <p>
            Connector readiness for Atlas. Owner-global rows are configured in
            Netlify env. Personal rows are added below in MCP Connections.
            Status surfacing only this sprint — live execution ships in a
            follow-up.
          </p>
        </div>
      </div>
      {connectors.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-ink-700 py-8 text-center">
          <p className="text-sm text-ink-400">No connectors registered yet.</p>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-ink-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-900/70 text-[10px] uppercase tracking-[0.18em] text-ink-300">
              <tr>
                <th className="px-3 py-2">Connector</th>
                <th className="px-3 py-2">Scope</th>
                <th className="px-3 py-2">Required env</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Tools</th>
              </tr>
            </thead>
            <tbody>
              {connectors.map((c) => (
                <tr key={c.id} className="border-t border-ink-800 align-top">
                  <td className="px-3 py-2.5 text-ink-100">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-[11px] text-ink-400">
                        {c.description}
                      </span>
                      {c.scope === "lo_personal" && (
                        <span className="text-[10.5px] text-ink-500">
                          {c.hasToken
                            ? "Auth token stored server-side."
                            : "No auth token saved."}
                          {c.savedAt
                            ? ` · Saved ${new Date(c.savedAt).toLocaleDateString()}`
                            : ""}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="rounded-full border border-ink-700 bg-ink-900/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-ink-300">
                      {scopeBadge(c.scope)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-ink-400">
                    {c.requiredEnv.length === 0 ? (
                      <span className="text-ink-500">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {c.requiredEnv.map((n) => (
                          <code
                            key={n}
                            className="rounded border border-ink-700 bg-ink-900/70 px-1.5 py-[1px] font-mono text-[10.5px] text-ink-200"
                          >
                            {n}
                          </code>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-medium ${statusPillClass(c.status)}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${statusDot(c.status)}`} />
                      {c.status === "not_configured"
                        ? "not configured"
                        : c.status}
                    </span>
                    {c.status === "not_configured" && (
                      <p className="mt-1 max-w-xs text-[10.5px] text-ink-400">
                        {c.setupInstructions}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-ink-300">
                    {c.availableTools.length === 0 ? (
                      <span className="text-ink-500">none yet</span>
                    ) : (
                      c.availableTools.join(", ")
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[11px] text-ink-300">
        {isOwner
          ? "Owner-controlled. Add or remove personal MCP servers in the MCP Connections section below. Set Netlify env vars to enable owner-global connectors."
          : "Read-only view of owner-global connectors. Personal MCP servers you save are also listed here. Ask the owner to set the env var if a connector is not configured."}
      </p>
    </section>
  );
}
