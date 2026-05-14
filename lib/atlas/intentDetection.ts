// Atlas intent detection — a tiny, deterministic, regex-only classifier that
// runs BEFORE we hit the AI provider. The goal is to catch obvious "do a
// thing" commands ("draft a post about X", "schedule a call tomorrow") and
// short-circuit straight into a tool call. Everything else falls through to
// normal chat. Keep this file pure-TS and side-effect-free so it stays cheap
// to invoke on every message.
//
// Supported channels for social posts mirror SocialChannel in the DB types.
export type SocialChannelLite =
  | "facebook"
  | "instagram"
  | "google_business_profile"
  | "youtube";

export type AtlasIntentKind =
  | "create_social"
  | "create_email"
  | "create_calendar"
  | "none";

export interface AtlasIntentSocial {
  kind: "create_social";
  extracted: {
    title: string | null;
    body: string;
    channels: SocialChannelLite[];
  };
}

export interface AtlasIntentEmail {
  kind: "create_email";
  extracted: {
    subject: string;
    body: string;
  };
}

export interface AtlasIntentCalendar {
  kind: "create_calendar";
  extracted: {
    title: string;
    starts_at: string; // ISO string
    date_phrase: string | null; // the raw phrase we matched, for debugging
  };
}

export interface AtlasIntentNone {
  kind: "none";
  extracted: Record<string, never>;
}

export type AtlasIntent =
  | AtlasIntentSocial
  | AtlasIntentEmail
  | AtlasIntentCalendar
  | AtlasIntentNone;

// Strip leading filler words ("for", "about", "regarding") so the extracted
// title reads cleanly.
function trimTopic(raw: string): string {
  return raw
    .trim()
    .replace(/^(?:for|about|regarding|on|to|that)\s+/i, "")
    .replace(/[.!?]+$/, "")
    .trim();
}

function inferSocialChannels(text: string): SocialChannelLite[] {
  const lower = text.toLowerCase();
  const channels: SocialChannelLite[] = [];
  if (/\bfacebook\b|\bfb\b/.test(lower)) channels.push("facebook");
  if (/\binstagram\b|\big\b|\binsta\b/.test(lower)) channels.push("instagram");
  if (/\byoutube\b|\byt\b/.test(lower)) channels.push("youtube");
  if (/\bgoogle business\b|\bgbp\b|\bgmb\b/.test(lower))
    channels.push("google_business_profile");
  // Default to facebook when the user didn't specify a network. Owners can
  // edit the draft afterwards in the Social composer.
  return channels.length > 0 ? channels : ["facebook"];
}

// Best-effort, no-deps date phrase resolver. Returns an ISO string for
// "today", "tomorrow", "monday"…"sunday", "next week", or an explicit
// YYYY-MM-DD. Falls back to "tomorrow 9am" so calendar items always land
// somewhere reasonable rather than getting rejected.
function resolveDatePhrase(phrase: string | null): {
  iso: string;
  matched: string | null;
} {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0);
  if (!phrase) {
    base.setDate(base.getDate() + 1);
    return { iso: base.toISOString(), matched: null };
  }
  const p = phrase.toLowerCase().trim();
  if (/^today\b/.test(p)) {
    return { iso: base.toISOString(), matched: "today" };
  }
  if (/^tomorrow\b/.test(p)) {
    base.setDate(base.getDate() + 1);
    return { iso: base.toISOString(), matched: "tomorrow" };
  }
  if (/^next week\b/.test(p)) {
    base.setDate(base.getDate() + 7);
    return { iso: base.toISOString(), matched: "next week" };
  }
  const weekdays = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const dayMatch = weekdays.findIndex((d) => new RegExp(`^${d}\\b`).test(p));
  if (dayMatch >= 0) {
    const diff = (dayMatch - base.getDay() + 7) % 7 || 7;
    base.setDate(base.getDate() + diff);
    return { iso: base.toISOString(), matched: weekdays[dayMatch] };
  }
  const ymd = p.match(/^(\d{4}-\d{2}-\d{2})/);
  if (ymd) {
    const parsed = new Date(`${ymd[1]}T09:00:00`);
    if (!isNaN(parsed.getTime())) {
      return { iso: parsed.toISOString(), matched: ymd[1] };
    }
  }
  // Unknown phrase — punt to tomorrow 9am.
  base.setDate(base.getDate() + 1);
  return { iso: base.toISOString(), matched: null };
}

// Main entry point. Caller must pass the raw user message string. The
// function never throws — when nothing matches we return `{ kind: 'none' }`.
export function detectAtlasIntent(message: string): AtlasIntent {
  const text = (message ?? "").trim();
  if (!text) return { kind: "none", extracted: {} };

  // --- Calendar (most specific patterns first, since "schedule a post" can
  // collide with "schedule a meeting") -------------------------------------
  const calRe =
    /^(?:please\s+)?(?:schedule|add\s+to\s+(?:my\s+)?calendar|block\s+(?:time|off)|put\s+on\s+(?:my\s+)?calendar)\b[: ]*(.+)$/i;
  const calMatch = text.match(calRe);
  if (calMatch && !/\b(?:post|tweet|newsletter|email)\b/i.test(calMatch[1])) {
    const body = calMatch[1].trim();
    // Split "X on tomorrow" / "X for monday" / "X at 2026-05-20" into title + when.
    const onAt = body.match(
      /^(.*?)\s+(?:on|at|for|by)\s+([a-z0-9\- ]{3,40})$/i
    );
    let title = body;
    let datePhrase: string | null = null;
    if (onAt) {
      title = onAt[1].trim();
      datePhrase = onAt[2].trim();
    }
    title = trimTopic(title) || "Calendar item";
    const resolved = resolveDatePhrase(datePhrase);
    return {
      kind: "create_calendar",
      extracted: {
        title,
        starts_at: resolved.iso,
        date_phrase: resolved.matched,
      },
    };
  }

  // --- Email --------------------------------------------------------------
  const emailRe =
    /^(?:please\s+)?(?:write|draft|compose|create)\s+(?:a\s+|an\s+|the\s+)?(?:newsletter|email|email\s+campaign)\b(?:\s+(?:about|for|on|to)\s+(.+))?$/i;
  const emailMatch = text.match(emailRe);
  if (emailMatch) {
    const topic = (emailMatch[1] ?? "").trim();
    const subject = topic
      ? topic.replace(/[.!?]+$/, "").slice(0, 140)
      : "Newsletter draft";
    return {
      kind: "create_email",
      extracted: {
        subject: subject.charAt(0).toUpperCase() + subject.slice(1),
        body: topic ? `Draft about: ${topic}` : "Draft newsletter.",
      },
    };
  }

  // --- Social -------------------------------------------------------------
  // Triggers: "draft a post", "create a social draft", "post to X about Y",
  // "write a social post", "draft a Facebook post about Y", "write an IG
  // caption", "make a YouTube post about Y". The optional channel adjective
  // (facebook|instagram|fb|ig|youtube|yt|gbp|gmb|google business) is allowed
  // BETWEEN the article and the noun so "Draft a Facebook post about FHA
  // loans" classifies as create_social, not a generic chat.
  const socialRe =
    /^(?:please\s+)?(?:draft|create|write|make|generate|post|compose|put\s+together)\s+(?:a\s+|an\s+|the\s+)?(?:(?:social|facebook|fb|instagram|ig|insta|youtube|yt|gbp|gmb|google\s+business)\s+)?(?:post|draft|update|status|caption|tweet|share|blurb)\b(?:\s+(?:to|on|for|about|regarding)\s+(.+))?$/i;
  const altSocialRe =
    /^(?:please\s+)?post\s+(?:to|on)\s+(facebook|instagram|youtube|gbp|gmb|google\s+business)\b(?:\s+about\s+(.+))?$/i;
  const m1 = text.match(socialRe);
  const m2 = text.match(altSocialRe);
  if (m1 || m2) {
    const topic = ((m1?.[1] ?? m2?.[2]) ?? "").trim();
    const title = topic ? trimTopic(topic).slice(0, 120) : null;
    const channels = inferSocialChannels(text);
    return {
      kind: "create_social",
      extracted: {
        title,
        body: topic ? `Draft post about: ${trimTopic(topic)}` : "Draft post.",
        channels,
      },
    };
  }

  return { kind: "none", extracted: {} };
}
