// Server-only Google OAuth token helpers (refresh + live probe).
// ---------------------------------------------------------------------------
// Used by the test-connection route and (later) by Gmail/Drive/Calendar calls.
// Tokens are read from oauth_token_grants via the service client and NEVER
// returned to a client. ensureFreshAccessToken transparently refreshes an
// expired access token using the stored refresh token.

import { getTokenGrant, storeTokenGrant } from "@/lib/integrations/tokenStore";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

const EXPIRY_BUFFER_MS = 60_000; // refresh if within 60s of expiry

export type FreshTokenResult =
  | { ok: true; accessToken: string; accountEmail: string | null; scopes: string[] }
  | { ok: false; reason: "not_connected" | "needs_reauth" | "not_configured" | "error"; message?: string };

function oauthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

async function refreshAccessToken(refreshToken: string): Promise<{
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
}> {
  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  return (await resp.json().catch(() => ({}))) as Awaited<ReturnType<typeof refreshAccessToken>>;
}

// Returns a usable access token for (userId, provider), refreshing if needed.
export async function ensureFreshAccessToken(userId: string, provider: string): Promise<FreshTokenResult> {
  if (!oauthConfigured()) return { ok: false, reason: "not_configured" };

  let grant;
  try {
    grant = await getTokenGrant(userId, provider);
  } catch (err) {
    return { ok: false, reason: "error", message: err instanceof Error ? err.message : "read failed" };
  }
  if (!grant || !grant.access_token) return { ok: false, reason: "not_connected" };

  const accountEmail =
    (grant.metadata && typeof grant.metadata === "object"
      ? ((grant.metadata as Record<string, unknown>).account_email as string | undefined)
      : undefined) ?? null;
  const scopes = grant.scopes ?? [];

  const expMs = grant.expires_at ? Date.parse(grant.expires_at) : 0;
  const stillValid = expMs && expMs - Date.now() > EXPIRY_BUFFER_MS;
  if (stillValid) {
    return { ok: true, accessToken: grant.access_token, accountEmail, scopes };
  }

  // Expired (or unknown expiry) — refresh if we have a refresh token.
  if (!grant.refresh_token) {
    return { ok: false, reason: "needs_reauth", message: "access token expired and no refresh token stored" };
  }
  const refreshed = await refreshAccessToken(grant.refresh_token);
  if (refreshed.error || !refreshed.access_token) {
    return { ok: false, reason: "needs_reauth", message: refreshed.error ?? "refresh failed" };
  }
  const newExpiresAt = refreshed.expires_in
    ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    : null;
  try {
    await storeTokenGrant({
      userId,
      provider,
      accessToken: refreshed.access_token,
      refreshToken: grant.refresh_token, // Google omits refresh_token on refresh; keep the old one
      tokenType: refreshed.token_type ?? grant.token_type ?? "Bearer",
      scopes: refreshed.scope ? refreshed.scope.split(/\s+/).filter(Boolean) : scopes,
      expiresAt: newExpiresAt,
      metadata: { account_email: accountEmail },
    });
  } catch {
    // Persisting the refreshed token failed; we can still use it for this probe.
  }
  return { ok: true, accessToken: refreshed.access_token, accountEmail, scopes };
}

// Cheap live probe: call Google's userinfo with the token. Returns connected +
// the account email, or the failure reason.
export async function probeGoogle(accessToken: string): Promise<{ ok: boolean; status: number; email: string | null }> {
  try {
    const resp = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!resp.ok) return { ok: false, status: resp.status, email: null };
    const info = (await resp.json().catch(() => ({}))) as { email?: string };
    return { ok: true, status: 200, email: info.email ?? null };
  } catch {
    return { ok: false, status: 0, email: null };
  }
}

// ---------------------------------------------------------------------------
// Server-only Google API call helpers.
// ---------------------------------------------------------------------------
// Each helper takes a fresh access token (obtained via ensureFreshAccessToken),
// makes the call, and returns parsed JSON — throwing a redacted error on any
// non-2xx HTTP status. Tokens are passed in the Authorization header ONLY and
// are NEVER logged, echoed, or included in a thrown message. Callers (the route
// handlers) own all gating; these are pure transport.

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

// Throw a redacted error for a failed Google API response. The token is never
// part of the message; we surface the endpoint label + HTTP status + Google's
// own (non-secret) error string when present.
async function googleError(label: string, resp: Response): Promise<never> {
  let detail = "";
  try {
    const body = (await resp.json()) as { error?: { message?: string } | string };
    const msg = typeof body.error === "string" ? body.error : body.error?.message;
    if (msg) detail = `: ${msg}`;
  } catch {
    // non-JSON error body — status alone is enough
  }
  throw new Error(`google ${label} failed (http ${resp.status})${detail}`);
}

// Encode a UTF-8 string to base64url (RFC 4648 §5) for Gmail raw messages.
function base64Url(input: string): string {
  return Buffer.from(input, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Build an RFC 822 message and return it base64url-encoded for the Gmail API.
function buildRawMessage(args: { to: string; subject: string; body: string }): string {
  const headers = [
    `To: ${args.to}`,
    `Subject: ${args.subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
  ];
  const rfc822 = `${headers.join("\r\n")}\r\n\r\n${args.body}`;
  return base64Url(rfc822);
}

// ---- Gmail -----------------------------------------------------------------

export interface GmailMessageSummary {
  id: string;
  from: string | null;
  subject: string | null;
  date: string | null;
  snippet: string | null;
}

// List recent messages — metadata + snippet ONLY. Never fetches full bodies or
// attachments (format=metadata, restricted header set). Read-only scope.
export async function gmailListRecent(token: string, max = 10): Promise<GmailMessageSummary[]> {
  const listUrl = new URL(`${GMAIL_API}/users/me/messages`);
  listUrl.searchParams.set("maxResults", String(Math.max(1, Math.min(max, 50))));
  const listResp = await fetch(listUrl.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!listResp.ok) await googleError("gmail.list", listResp);
  const listJson = (await listResp.json()) as { messages?: Array<{ id: string }> };
  const ids = (listJson.messages ?? []).map((m) => m.id).filter(Boolean);

  const summaries: GmailMessageSummary[] = [];
  for (const id of ids) {
    const metaUrl = new URL(`${GMAIL_API}/users/me/messages/${encodeURIComponent(id)}`);
    metaUrl.searchParams.set("format", "metadata");
    metaUrl.searchParams.append("metadataHeaders", "From");
    metaUrl.searchParams.append("metadataHeaders", "Subject");
    metaUrl.searchParams.append("metadataHeaders", "Date");
    const metaResp = await fetch(metaUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!metaResp.ok) await googleError("gmail.get", metaResp);
    const meta = (await metaResp.json()) as {
      id: string;
      snippet?: string;
      payload?: { headers?: Array<{ name: string; value: string }> };
    };
    const headerMap = new Map(
      (meta.payload?.headers ?? []).map((h) => [h.name.toLowerCase(), h.value] as const)
    );
    summaries.push({
      id: meta.id,
      from: headerMap.get("from") ?? null,
      subject: headerMap.get("subject") ?? null,
      date: headerMap.get("date") ?? null,
      snippet: meta.snippet ?? null,
    });
  }
  return summaries;
}

// Create a Gmail draft (no send). Requires gmail.compose/modify scope.
export async function gmailCreateDraft(
  token: string,
  args: { to: string; subject: string; body: string }
): Promise<{ id: string | null; messageId: string | null }> {
  const raw = buildRawMessage(args);
  const resp = await fetch(`${GMAIL_API}/users/me/drafts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { raw } }),
  });
  if (!resp.ok) await googleError("gmail.drafts.create", resp);
  const json = (await resp.json()) as { id?: string; message?: { id?: string } };
  return { id: json.id ?? null, messageId: json.message?.id ?? null };
}

// Send a Gmail message. Requires gmail.send scope. The caller MUST have already
// passed every live-action gate (connection + user-enabled + explicit confirm).
export async function gmailSend(
  token: string,
  args: { to: string; subject: string; body: string }
): Promise<{ id: string | null; threadId: string | null }> {
  const raw = buildRawMessage(args);
  const resp = await fetch(`${GMAIL_API}/users/me/messages/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!resp.ok) await googleError("gmail.send", resp);
  const json = (await resp.json()) as { id?: string; threadId?: string };
  return { id: json.id ?? null, threadId: json.threadId ?? null };
}

// ---- Drive -----------------------------------------------------------------

export interface DriveFile {
  id: string;
  name: string | null;
  mimeType: string | null;
  parents: string[] | null;
}

// List folders, optionally within a parent. Read-only scope is sufficient.
export async function driveListFolders(token: string, parentId?: string): Promise<DriveFile[]> {
  const clauses = ["mimeType = 'application/vnd.google-apps.folder'", "trashed = false"];
  if (parentId) clauses.push(`'${parentId.replace(/'/g, "\\'")}' in parents`);
  const url = new URL(`${DRIVE_API}/files`);
  url.searchParams.set("q", clauses.join(" and "));
  url.searchParams.set("fields", "files(id,name,mimeType,parents)");
  url.searchParams.set("pageSize", "100");
  url.searchParams.set("orderBy", "name");
  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) await googleError("drive.list", resp);
  const json = (await resp.json()) as { files?: DriveFile[] };
  return json.files ?? [];
}

// Create a Drive folder. Requires a write scope.
export async function driveCreateFolder(
  token: string,
  args: { name: string; parentId?: string }
): Promise<DriveFile> {
  const metadata: Record<string, unknown> = {
    name: args.name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (args.parentId) metadata.parents = [args.parentId];
  const url = new URL(`${DRIVE_API}/files`);
  url.searchParams.set("fields", "id,name,mimeType,parents");
  const resp = await fetch(url.toString(), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });
  if (!resp.ok) await googleError("drive.folders.create", resp);
  return (await resp.json()) as DriveFile;
}

// Upload a file via multipart (metadata + base64-decoded content). Write scope.
export async function driveUpload(
  token: string,
  args: { name: string; mimeType: string; contentBase64: string; parentId?: string }
): Promise<DriveFile> {
  const metadata: Record<string, unknown> = { name: args.name };
  if (args.parentId) metadata.parents = [args.parentId];

  const boundary = `legendsos-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const content = Buffer.from(args.contentBase64, "base64");
  const head = Buffer.from(
    `--${boundary}\r\n` +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${args.mimeType}\r\n\r\n`,
    "utf-8"
  );
  const tail = Buffer.from(`\r\n--${boundary}--`, "utf-8");
  const multipartBody = Buffer.concat([head, content, tail]);

  const url = new URL(`${DRIVE_UPLOAD_API}/files`);
  url.searchParams.set("uploadType", "multipart");
  url.searchParams.set("fields", "id,name,mimeType,parents");
  const resp = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });
  if (!resp.ok) await googleError("drive.upload", resp);
  return (await resp.json()) as DriveFile;
}

// Move a file by changing its parents. Write scope.
export async function driveMoveFile(
  token: string,
  args: { fileId: string; addParents: string; removeParents: string }
): Promise<DriveFile> {
  const url = new URL(`${DRIVE_API}/files/${encodeURIComponent(args.fileId)}`);
  url.searchParams.set("addParents", args.addParents);
  url.searchParams.set("removeParents", args.removeParents);
  url.searchParams.set("fields", "id,name,mimeType,parents");
  const resp = await fetch(url.toString(), {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!resp.ok) await googleError("drive.move", resp);
  return (await resp.json()) as DriveFile;
}

// ---- Calendar --------------------------------------------------------------

export interface CalendarEventSummary {
  id: string;
  summary: string | null;
  start: Record<string, unknown> | null;
  end: Record<string, unknown> | null;
  htmlLink: string | null;
  status: string | null;
}

// List upcoming events on a calendar. calendar.events scope (read).
export async function calendarListEvents(
  token: string,
  args: { calendarId?: string; timeMin?: string; max?: number } = {}
): Promise<CalendarEventSummary[]> {
  const calendarId = args.calendarId ?? "primary";
  const url = new URL(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set("maxResults", String(Math.max(1, Math.min(args.max ?? 10, 50))));
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("timeMin", args.timeMin ?? new Date().toISOString());
  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) await googleError("calendar.list", resp);
  const json = (await resp.json()) as { items?: CalendarEventSummary[] };
  return json.items ?? [];
}

// Create a calendar event. Write — caller MUST have passed all live gates.
export async function calendarCreateEvent(
  token: string,
  args: {
    summary: string;
    start: Record<string, unknown>;
    end: Record<string, unknown>;
    description?: string;
    attendees?: string[];
    calendarId?: string;
  }
): Promise<CalendarEventSummary> {
  const calendarId = args.calendarId ?? "primary";
  const event: Record<string, unknown> = {
    summary: args.summary,
    start: args.start,
    end: args.end,
  };
  if (args.description) event.description = args.description;
  if (args.attendees && args.attendees.length > 0) {
    event.attendees = args.attendees.map((email) => ({ email }));
  }
  const resp = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  if (!resp.ok) await googleError("calendar.events.create", resp);
  return (await resp.json()) as CalendarEventSummary;
}

// Patch an existing calendar event. Write — caller MUST have passed all gates.
export async function calendarUpdateEvent(
  token: string,
  args: { eventId: string; patch: Record<string, unknown>; calendarId?: string }
): Promise<CalendarEventSummary> {
  const calendarId = args.calendarId ?? "primary";
  const resp = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(args.eventId)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args.patch),
    }
  );
  if (!resp.ok) await googleError("calendar.events.update", resp);
  return (await resp.json()) as CalendarEventSummary;
}
