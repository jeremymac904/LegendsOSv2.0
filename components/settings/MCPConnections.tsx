"use client";

import { useCallback, useEffect, useState } from "react";

interface MCPConnection {
  id: string;
  label: string;
  url: string;
  auth_token?: string;
  provider: "zapier" | "composio" | "custom";
  saved_at: string | null;
}

export function MCPConnections() {
  const [connections, setConnections] = useState<MCPConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // New connection form state
  const [showForm, setShowForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newToken, setNewToken] = useState("");
  const [newProvider, setNewProvider] = useState<"zapier" | "composio" | "custom">("zapier");

  const loadConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/mcp");
      const data = await res.json();
      if (data.ok) setConnections(data.connections ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  async function addConnection() {
    if (!newLabel.trim() || !newUrl.trim()) return;
    setSaveStatus(null);
    try {
      const res = await fetch("/api/integrations/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: newLabel.trim(),
          url: newUrl.trim(),
          auth_token: newToken.trim() || undefined,
          provider: newProvider,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setShowForm(false);
        setNewLabel("");
        setNewUrl("");
        setNewToken("");
        setSaveStatus("saved");
        await loadConnections();
      } else {
        setSaveStatus(data.error ?? "failed");
      }
    } catch {
      setSaveStatus("network error");
    }
  }

  async function removeConnection(id: string) {
    try {
      await fetch(`/api/integrations/mcp?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      await loadConnections();
    } catch {
      // silent
    }
  }

  function providerBadge(provider: string) {
    const styles: Record<string, string> = {
      zapier: "bg-accent-gold/10 text-accent-gold border-accent-gold/35",
      composio: "bg-ink-100 text-ink-700 border-ink-300 dark:bg-ink-800 dark:text-ink-200 dark:border-ink-700",
      custom: "bg-ink-100 text-ink-700 border-ink-300 dark:bg-ink-700 dark:text-ink-200 dark:border-ink-600",
    };
    return (
      <span
        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
          styles[provider] || styles.custom
        }`}
      >
        {provider}
      </span>
    );
  }

  return (
    <section className="card-padded">
      <div className="section-title">
        <div>
          <h2>MCP Connections</h2>
          <p>
            Recommended for publishing: save your Zapier MCP endpoint, then use
            Zapier to connect Facebook, Instagram, YouTube, TikTok, Google
            Business Profile, and LinkedIn. Saved endpoints are not marked live
            until you verify them.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="btn-ghost text-xs"
        >
          {showForm ? "Cancel" : "+ Add server"}
        </button>
      </div>

      {showForm && (
        <div className="mt-4 space-y-3 rounded-xl border border-ink-200 bg-ink-50 p-4 dark:border-ink-700 dark:bg-ink-900/60">
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-ink-600 dark:text-ink-300">
              Provider
            </label>
            <div className="flex gap-2">
              {(["zapier", "composio", "custom"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setNewProvider(p)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition ${
                    newProvider === p
                      ? "border-accent-gold/40 bg-accent-gold/10 text-accent-gold"
                      : "border-ink-300 text-ink-700 hover:border-ink-400 dark:border-ink-700 dark:text-ink-300 dark:hover:border-ink-500"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-ink-600 dark:text-ink-300">
              Label
            </label>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. My Zapier Tools"
              className="w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-accent-gold/50 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100 dark:placeholder:text-ink-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-ink-600 dark:text-ink-300">
              MCP Server URL
            </label>
            <input
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder={
                newProvider === "zapier"
                  ? "https://mcp.zapier.com/mcp/servers/your-id/stream"
                  : "https://your-mcp-server.example.com/mcp"
              }
              className="w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-accent-gold/50 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100 dark:placeholder:text-ink-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-ink-600 dark:text-ink-300">
            Auth Token{" "}
              <span className="text-ink-500">(optional — for Bearer auth)</span>
            </label>
            <input
              type="password"
              value={newToken}
              onChange={(e) => setNewToken(e.target.value)}
              placeholder="Bearer sk-..."
              className="w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-accent-gold/50 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100 dark:placeholder:text-ink-500"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={addConnection}
              disabled={!newLabel.trim() || !newUrl.trim()}
              className="btn-primary text-xs disabled:opacity-40"
            >
              Save endpoint
            </button>
            {saveStatus === "saved" && (
              <span className="text-[11px] text-accent-gold">
                Saved. Verify before publishing.
              </span>
            )}
            {saveStatus && saveStatus !== "saved" && (
              <span className="text-[11px] text-status-err">{saveStatus}</span>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {loading ? (
          <p className="py-4 text-center text-[11px] text-ink-600 dark:text-ink-400">
            Loading connections...
          </p>
        ) : connections.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-300 py-8 text-center dark:border-ink-700">
            <p className="text-sm text-ink-700 dark:text-ink-400">
              No MCP servers saved yet.
            </p>
            <p className="mt-1 text-[11px] text-ink-600 dark:text-ink-500">
              Add Zapier MCP first for the recommended social publishing path.
            </p>
          </div>
        ) : (
          connections.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-lg border border-ink-200 bg-white px-3 py-2.5 dark:border-ink-800 dark:bg-ink-900/40"
            >
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink-900 dark:text-ink-100">
                      {c.label}
                    </span>
                    {providerBadge(c.provider)}
                    <span className="rounded-full border border-status-warn/30 bg-status-warn/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-status-warn">
                      saved · not verified
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-ink-600 dark:text-ink-400">
                    {c.url.length > 60
                      ? c.url.slice(0, 50) + "..." + c.url.slice(-12)
                      : c.url}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {c.saved_at && (
                  <span className="text-[10px] text-ink-600 dark:text-ink-500">
                    {new Date(c.saved_at).toLocaleDateString()}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeConnection(c.id)}
                  className="rounded px-2 py-1 text-[10px] text-status-err transition hover:bg-status-err/10"
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-[11px] text-ink-600 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-300">
          How to get your MCP server URL
        </summary>
        <div className="mt-2 space-y-2 rounded-lg border border-ink-200 bg-ink-50 p-3 text-xs text-ink-700 dark:border-ink-800 dark:bg-ink-900/30 dark:text-ink-300">
          <p>
            <strong className="text-ink-900 dark:text-ink-200">Zapier MCP:</strong> Go to{" "}
            <code className="text-ink-900 dark:text-ink-100">zapier.com/mcp</code>, sign in, and
            create a new MCP server. Connect your apps (Gmail, Calendar,
            Sheets, etc.), then copy the server URL and auth token.
          </p>
          <p>
            <strong className="text-ink-900 dark:text-ink-200">Composio:</strong> Go to{" "}
            <code className="text-ink-900 dark:text-ink-100">composio.dev</code>, create a
            session, and use the MCP endpoint from your dashboard.
          </p>
          <p>
            <strong className="text-ink-900 dark:text-ink-200">Custom:</strong> Any
            MCP-compatible server that supports the Streamable HTTP transport.
            Run it locally or host it — just provide the URL.
          </p>
        </div>
      </details>
    </section>
  );
}
