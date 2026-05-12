// Tiny RFC4180-ish CSV parser. We avoid pulling in a dependency for this —
// the schema we accept is well-defined, ASCII, and authored by humans/tools
// that already quote fields containing commas, quotes, or newlines.
//
// Supports:
//   * quoted fields with "" escaping
//   * fields containing commas / newlines when quoted
//   * \r\n and \n line endings
//   * trailing newline tolerance
//
// The parser is generator-based so we can stream-process 5000+ rows without
// allocating the whole file as an array of arrays.

export function* parseCsv(text: string): Generator<string[]> {
  const len = text.length;
  let i = 0;
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  while (i < len) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      // \r\n: emit row on \n; skip the \r
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      // Skip blank lines.
      if (!(row.length === 1 && row[0] === "")) {
        yield row;
      }
      row = [];
      field = "";
      i++;
      continue;
    }
    field += ch;
    i++;
  }

  // Final row (no trailing newline)
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (!(row.length === 1 && row[0] === "")) {
      yield row;
    }
  }
}

// Map CSV header → canonical contact column name. Built-in aliases cover the
// upload format Jeremy uses (the column captions are the user-facing labels);
// callers can override or extend via the second argument.
const DEFAULT_HEADER_MAP: Record<string, string> = {
  "full name": "full_name",
  "first name": "first_name",
  "last name": "last_name",
  email: "email",
  "email 2": "email_2",
  phone: "phone",
  "phone 2": "phone_2",
  "office phone": "office_phone",
  "office name": "office_name",
  city: "city",
  state: "state",
  "state license": "state_license",
  facebook: "facebook_url",
  "facebook url": "facebook_url",
  instagram: "instagram_url",
  "instagram url": "instagram_url",
  linkedin: "linkedin_url",
  "linkedin url": "linkedin_url",
  twitter: "x_url",
  "x twitter": "x_url",
  "x (twitter)": "x_url",
  x: "x_url",
  youtube: "youtube_url",
  "youtube url": "youtube_url",
  tiktok: "tiktok_url",
  "tiktok url": "tiktok_url",
  zillow: "zillow_url",
  "zillow url": "zillow_url",
  "other links": "other_links",
  "transaction count": "transaction_count",
  "total volume": "total_volume",
  "buyer volume": "buyer_volume",
  "buyer units": "buyer_units",
};

export function canonicalHeaders(
  raw: string[],
  overrides?: Record<string, string>
): Array<string | null> {
  const map = { ...DEFAULT_HEADER_MAP, ...(overrides ?? {}) };
  return raw.map((h) => {
    const norm = h.trim().toLowerCase();
    return map[norm] ?? null;
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (!EMAIL_RE.test(v)) return null;
  return v;
}

export function trimOrNull(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  return v ? v : null;
}

export function parseNumberOrNull(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const v = raw.replace(/[^\d.\-]/g, "");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export interface ParsedRow {
  row_number: number; // 1-based, header is row 1
  raw: string[];
  canonical: Record<string, string | null>;
  email: string | null;
  email_2: string | null;
  // If the row failed validation outright, callers should skip it and add to
  // the import's error log.
  error: string | null;
}

export function* parseContacts(
  text: string,
  options?: { headerOverrides?: Record<string, string> }
): Generator<ParsedRow> {
  const rows = parseCsv(text);
  const firstRow = rows.next();
  if (firstRow.done) return;
  const headers = canonicalHeaders(firstRow.value, options?.headerOverrides);
  let rowNumber = 1;
  for (const raw of rows) {
    rowNumber++;
    const canonical: Record<string, string | null> = {};
    for (let i = 0; i < headers.length; i++) {
      const key = headers[i];
      if (!key) continue;
      canonical[key] = trimOrNull(raw[i]);
    }
    const email = normalizeEmail(canonical["email"]);
    const email_2 = normalizeEmail(canonical["email_2"]);
    // Empty rows (all blank) — skip silently.
    const hasAnyValue = Object.values(canonical).some((v) => v && v.length > 0);
    if (!hasAnyValue) continue;
    yield { row_number: rowNumber, raw, canonical, email, email_2, error: null };
  }
}
