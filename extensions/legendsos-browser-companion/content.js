/**
 * LegendsOS Browser Companion — content.js
 *
 * Runs in the page (loan portal) context. Its ONLY job is to assemble a SAFE,
 * visible context snapshot when asked by the side panel / popup.
 *
 * HARD SAFETY RULES enforced here:
 *  - NEVER reads document.cookie, localStorage, or sessionStorage.
 *  - NEVER reads input[type=password] or hidden inputs.
 *  - NEVER reads any field whose name/id/label/placeholder/autocomplete
 *    suggests SSN, DOB, account number, routing number, card, tax id, PIN.
 *  - Strips obvious secret-looking tokens from captured text.
 *  - Captures only visible text (selection + headings/labels/section text).
 *
 * It never sends anything itself — it replies to a runtime message and the
 * side panel / popup decides what to do. No PII is ever console.logged.
 */

(function () {
  "use strict";

  // ---- Sensitive-field detection ------------------------------------------

  // If any of these fragments appear in a field's name/id/label/placeholder/
  // autocomplete, we treat the field as sensitive and exclude its value AND
  // any associated label text from capture.
  const SENSITIVE_FRAGMENTS = [
    "ssn",
    "social",
    "socialsecurity",
    "dob",
    "dateofbirth",
    "birth",
    "account",
    "acct",
    "routing",
    "aba",
    "iban",
    "swift",
    "card",
    "cardnumber",
    "cc-number",
    "cvv",
    "cvc",
    "cvn",
    "pin",
    "taxid",
    "ein",
    "tin",
    "passport",
    "license",
    "driverslicense",
    "creditscore",
    "fico",
    "password",
    "passcode",
    "secret",
  ];

  // Patterns that look like secrets/PII in free text; redact before sending.
  const REDACTION_PATTERNS = [
    // SSN-like: 123-45-6789 or 123456789 (with separators)
    { re: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, with: "[redacted-id]" },
    // Long digit runs (account/card-like): 12+ digits, optionally spaced/dashed
    { re: /\b(?:\d[ -]?){12,19}\b/g, with: "[redacted-number]" },
    // Bearer / API-key-ish tokens
    { re: /\b(?:sk|pk|rk|api|key|token|bearer)[_-][A-Za-z0-9]{12,}\b/gi, with: "[redacted-token]" },
    // Long opaque tokens (jwt-ish or base64-ish blobs)
    { re: /\b[A-Za-z0-9_-]{40,}\b/g, with: "[redacted-token]" },
  ];

  const MAX_SELECTION = 6000;
  const MAX_STRUCTURED_ITEMS = 60;
  const MAX_ITEM_LEN = 240;
  const MAX_TOTAL_STRUCTURED = 8000;

  function lower(s) {
    return String(s || "").toLowerCase();
  }

  function fieldLooksSensitive(el) {
    if (!el) return false;
    const probe = [
      el.getAttribute && el.getAttribute("name"),
      el.id,
      el.getAttribute && el.getAttribute("placeholder"),
      el.getAttribute && el.getAttribute("autocomplete"),
      el.getAttribute && el.getAttribute("aria-label"),
    ]
      .filter(Boolean)
      .map(lower)
      .join(" ");
    // Also consider an associated <label>'s text.
    let labelText = "";
    try {
      if (el.id) {
        const lbl = document.querySelector('label[for="' + cssEscape(el.id) + '"]');
        if (lbl) labelText = lower(lbl.textContent);
      }
      const wrapLabel = el.closest && el.closest("label");
      if (wrapLabel) labelText += " " + lower(wrapLabel.textContent);
    } catch (_e) {
      /* ignore selector errors */
    }
    const hay = probe + " " + labelText;
    return SENSITIVE_FRAGMENTS.some((frag) => hay.includes(frag));
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }
    // Minimal fallback for older engines.
    return String(value).replace(/["\\\]\[#.:>+~*^$|()=]/g, "\\$&");
  }

  function redact(text) {
    if (!text) return "";
    let out = String(text);
    for (const { re, with: rep } of REDACTION_PATTERNS) {
      out = out.replace(re, rep);
    }
    return out;
  }

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const style = window.getComputedStyle(el);
    if (!style) return false;
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1;
  }

  function cleanWhitespace(s) {
    return String(s || "").replace(/\s+/g, " ").trim();
  }

  function getSelectionText() {
    try {
      const sel = window.getSelection();
      if (!sel) return "";
      const text = cleanWhitespace(sel.toString());
      return redact(text).slice(0, MAX_SELECTION);
    } catch (_e) {
      return "";
    }
  }

  // Collect SAFE visible structured context: headings, visible labels, and
  // short visible section text. Explicitly excludes form values entirely —
  // we read labels/headings, NOT what the user typed.
  function collectStructuredContext() {
    const items = [];
    let totalLen = 0;

    function push(kind, text) {
      const cleaned = cleanWhitespace(text);
      if (!cleaned) return;
      const redacted = redact(cleaned).slice(0, MAX_ITEM_LEN);
      if (!redacted) return;
      if (items.length >= MAX_STRUCTURED_ITEMS) return;
      if (totalLen + redacted.length > MAX_TOTAL_STRUCTURED) return;
      // De-dupe trivial repeats.
      if (items.some((i) => i.text === redacted && i.kind === kind)) return;
      items.push({ kind, text: redacted });
      totalLen += redacted.length;
    }

    // Headings give us the page structure.
    const headings = document.querySelectorAll("h1, h2, h3, [role='heading']");
    headings.forEach((h) => {
      if (isVisible(h)) push("heading", h.textContent);
    });

    // Visible standalone labels (NOT sensitive). We capture the label text
    // only — never the field value.
    const labels = document.querySelectorAll("label, dt, th");
    labels.forEach((l) => {
      if (!isVisible(l)) return;
      // Find a control this label points at; if it's sensitive, skip the label.
      let control = null;
      try {
        const forId = l.getAttribute && l.getAttribute("for");
        if (forId) control = document.getElementById(forId);
        if (!control && l.querySelector) {
          control = l.querySelector("input, select, textarea");
        }
      } catch (_e) {
        /* ignore */
      }
      if (control && fieldLooksSensitive(control)) return;
      push("label", l.textContent);
    });

    return items;
  }

  // Build a compact, human-readable summary string from the structured items
  // so downstream consumers (Atlas prompt) have something to work with even if
  // they ignore the JSON array.
  function buildContextSummary(structured, selection) {
    const parts = [];
    if (selection) {
      parts.push("Selected text: " + selection);
    }
    const headings = structured.filter((i) => i.kind === "heading").map((i) => i.text);
    if (headings.length) {
      parts.push("Page sections: " + headings.slice(0, 12).join(" | "));
    }
    const labels = structured.filter((i) => i.kind === "label").map((i) => i.text);
    if (labels.length) {
      parts.push("Visible fields/labels: " + labels.slice(0, 24).join(", "));
    }
    return cleanWhitespace(parts.join("\n")).slice(0, MAX_TOTAL_STRUCTURED);
  }

  function captureContext() {
    const selection = getSelectionText();
    const structured = collectStructuredContext();
    const summary = buildContextSummary(structured, selection);

    return {
      sourceUrl: location.href,
      sourceTitle: cleanWhitespace(document.title).slice(0, 300),
      sourceDomain: location.hostname,
      selectedText: selection,
      structuredContext: {
        items: structured,
        summary,
        capturedAtClient: new Date().toISOString(),
      },
    };
  }

  // ---- Message bridge ------------------------------------------------------

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "LEGENDSOS_CAPTURE") return undefined;
    try {
      const payload = captureContext();
      sendResponse({ ok: true, payload });
    } catch (_e) {
      // Never leak page content into the error.
      sendResponse({ ok: false, error: "capture_failed" });
    }
    // Synchronous response.
    return false;
  });
})();
