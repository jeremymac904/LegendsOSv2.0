/**
 * LegendsOS Browser Companion — companion.js (shared UI logic)
 *
 * Shared between sidepanel.js and popup.js. Owns:
 *  - session check (GET /api/browser-companion/session, credentials:'include')
 *  - capturing the active tab (via background.js)
 *  - building role-appropriate seeded prompts per task + assistant
 *  - POSTing the capture to LegendsOS, with a /browser-companion#payload=
 *    fallback when the direct cross-origin POST is blocked (CORS / no cookie)
 *  - opening Atlas (/atlas?prompt=) or /browser-companion in a new tab
 *
 * Stores NO tokens. All authenticated calls rely on the user's existing
 * LegendsOS web-session cookie via credentials:'include'.
 *
 * Loaded as a classic script after config.js; exposes globalThis.LegendsOSCompanion.
 */

(function () {
  "use strict";

  const Config = globalThis.LegendsOSConfig;

  // ---- Tasks --------------------------------------------------------------

  // Each task produces a role-appropriate instruction. The captured context
  // summary is prepended at prompt-build time.
  const TASKS = {
    send: {
      label: "Send to assistant",
      instruction:
        "Review the captured loan-portal context above and help me with it. " +
        "Tell me what this page is, what stage the file appears to be in, and " +
        "the most useful next action.",
    },
    summarize: {
      label: "Summarize visible page",
      instruction:
        "Summarize the captured page in a few tight bullet points: what it is, " +
        "the key facts visible, and anything that looks incomplete or needs " +
        "attention. Do not invent details that aren't in the context.",
    },
    draftNote: {
      label: "Draft note",
      instruction:
        "Draft a short, professional internal note capturing the current state " +
        "of this file based on the context above, suitable for pasting into the " +
        "loan record or a team thread.",
    },
    missingItems: {
      label: "Find missing items",
      instruction:
        "Based on the visible labels and sections in the context above, list the " +
        "items that appear to be missing, blank, or outstanding for this loan " +
        "file. Be specific and only flag things supported by the context.",
    },
    borrowerQuestions: {
      label: "Generate borrower question list",
      instruction:
        "Generate a clear, friendly list of questions to ask the borrower to " +
        "move this file forward, based on the gaps visible in the context above. " +
        "Group related questions and keep it concise.",
    },
  };

  // Role framing per assistant. All map to Atlas today (honest: dedicated
  // FLO/Coordinator assistants are configured later).
  const FRAMING = {
    owner:
      "You are Atlas, acting as the mortgage owner/loan-officer's right hand. " +
      "Frame your help around closing the deal and serving the borrower.",
    processor:
      "You are Atlas, acting in a file/loan-processor (FLO) capacity. Frame " +
      "your help around documentation completeness, conditions, and pipeline hygiene.",
    coordinator:
      "You are Atlas, acting as a transaction coordinator. Frame your help " +
      "around timelines, follow-ups, and keeping all parties aligned.",
  };

  function assistantById(id) {
    return Config.ASSISTANTS.find((a) => a.id === id) || Config.ASSISTANTS[0];
  }

  function taskById(id) {
    return TASKS[id] ? { id, ...TASKS[id] } : { id: "send", ...TASKS.send };
  }

  // The capture API's canonical `assistant` enum is owner|loan_officer|
  // processor|coordinator (see lib/browserCompanion/store.ts normalizeAssistant).
  // The extension's ASSISTANTS framing is owner|processor|coordinator; map it
  // onto the enum. Unknown values fall back to the server default (loan_officer).
  function assistantEnumFor(assistant) {
    switch (assistant && assistant.framing) {
      case "owner":
        return "owner";
      case "processor":
        return "processor";
      case "coordinator":
        return "coordinator";
      default:
        return "loan_officer";
    }
  }

  // The capture API validates source_url as a real http(s) URL (or empty). Only
  // forward a value that actually parses so an odd scheme never 400s the POST.
  function httpUrlOrEmpty(url) {
    if (!url || typeof url !== "string") return "";
    try {
      const u = new URL(url);
      return u.protocol === "http:" || u.protocol === "https:" ? url : "";
    } catch (_e) {
      return "";
    }
  }

  // Build the canonical snake_case POST body the capture API expects. We send
  // the task INSTRUCTION text (not the task id) as `task`, and map the assistant
  // framing onto the server enum. The redaction already happened in content.js.
  function buildCapturePayload(assistantId, taskId, capture) {
    const assistant = assistantById(assistantId);
    const task = taskById(taskId);
    return {
      source_url: httpUrlOrEmpty(capture.sourceUrl),
      source_title: capture.sourceTitle || "",
      selected_text: capture.selectedText || "",
      structured_context: capture.structuredContext || {},
      task: task.instruction,
      assistant: assistantEnumFor(assistant),
    };
  }

  // Build the seeded Atlas prompt: role framing + captured context summary +
  // the task instruction. Never includes raw form values (content.js excludes
  // them) and never includes secrets (content.js redacts them).
  function buildSeededPrompt(assistantId, taskId, capture) {
    const assistant = assistantById(assistantId);
    const task = taskById(taskId);
    const framing = FRAMING[assistant.framing] || FRAMING.owner;

    const lines = [];
    lines.push(framing);
    lines.push("");
    lines.push("--- Captured browser context (from the LegendsOS Companion) ---");
    lines.push("Source: " + (capture.sourceTitle || "(untitled)") + " <" + capture.sourceUrl + ">");
    if (capture.sourceDomain) lines.push("Domain: " + capture.sourceDomain);
    const summary =
      (capture.structuredContext && capture.structuredContext.summary) || "";
    if (summary) {
      lines.push("");
      lines.push(summary);
    } else if (capture.selectedText) {
      lines.push("");
      lines.push("Selected text: " + capture.selectedText);
    } else {
      lines.push("(No selectable text was captured from this page.)");
    }
    lines.push("--- End captured context ---");
    lines.push("");
    lines.push("Task: " + task.instruction);

    // Keep well under the /atlas?prompt= slice cap (8000 on the server).
    return lines.join("\n").slice(0, 7500);
  }

  // ---- Session ------------------------------------------------------------

  // Returns { status: 'authed'|'unauthed'|'setupNeeded'|'unreachable', user?, detail? }
  async function checkSession() {
    const base = await Config.getBaseUrl();
    let res;
    try {
      res = await fetch(base + Config.API.session, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
    } catch (_e) {
      return { status: "unreachable", base };
    }

    if (res.status === 401) {
      return { status: "unauthed", base };
    }
    // The companion API treats a missing table as "not provisioned yet" and is
    // expected to return 503 with { setupNeeded: true } in that case.
    if (res.status === 503) {
      return { status: "setupNeeded", base };
    }
    if (!res.ok) {
      return { status: "unreachable", base, detail: "http_" + res.status };
    }
    let body = null;
    try {
      body = await res.json();
    } catch (_e) {
      body = null;
    }
    if (body && body.setupNeeded) {
      return { status: "setupNeeded", base };
    }
    return {
      status: "authed",
      base,
      user: (body && (body.user || body.email)) || null,
    };
  }

  // ---- Capture ------------------------------------------------------------

  async function captureActiveTab() {
    const res = await chrome.runtime.sendMessage({
      type: "LEGENDSOS_CAPTURE_ACTIVE_TAB",
    });
    if (!res || !res.ok) {
      const code = (res && res.error) || "capture_failed";
      throw new Error(code);
    }
    return res.payload;
  }

  // ---- Routing / POST -----------------------------------------------------

  // POST the capture to LegendsOS using the canonical snake_case contract.
  // On success returns { captureId, routingLink, seededPrompt, assistant, task }.
  // On network/CORS failure throws with `.fallback` so the caller can fall back
  // to the #payload= hand-off. A 401 throws with `.unauthed`.
  async function postCapture(base, assistantId, taskId, capture) {
    const assistant = assistantById(assistantId);
    const task = taskById(taskId);
    const seededPrompt = buildSeededPrompt(assistantId, taskId, capture);
    const payload = buildCapturePayload(assistantId, taskId, capture);

    let res;
    try {
      res = await fetch(base + Config.API.capture, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (_e) {
      // Network/CORS blocked — signal fallback.
      const err = new Error("post_blocked");
      err.fallback = true;
      throw err;
    }

    if (res.status === 401) {
      const err = new Error("unauthed");
      err.unauthed = true;
      throw err;
    }
    if (!res.ok) {
      // Treat server errors as fallback-able so the user still gets routed.
      const err = new Error("post_http_" + res.status);
      err.fallback = true;
      throw err;
    }

    let body = null;
    try {
      body = await res.json();
    } catch (_e) {
      body = null;
    }

    // The capture API answers HTTP 200 with { ok:false, error:"setup_needed" }
    // when storage isn't provisioned yet — still returns a routing href so the
    // capture is never a dead end. Treat a non-ok body as fallback-able.
    if (body && body.ok === false) {
      const err = new Error(body.error || "capture_not_saved");
      err.fallback = true;
      // Carry the server routing href so the caller can still open Atlas.
      err.routingLink =
        (body.routing && body.routing.href && base + body.routing.href) || null;
      throw err;
    }

    const routing = (body && body.routing) || null;
    return {
      captureId: (body && body.capture_id) || null,
      // The server returns a routing href (path); make it absolute for openTab.
      routingLink: (routing && routing.href && base + routing.href) || null,
      seededPrompt: (routing && routing.seeded_prompt) || seededPrompt,
      assistant,
      task,
    };
  }

  // Build the Atlas deep-link for a seeded prompt.
  function atlasLink(base, seededPrompt) {
    return base + "/atlas?prompt=" + encodeURIComponent(seededPrompt);
  }

  // Build the web fallback URL: the authenticated web app reads #payload= and
  // saves the capture server-side, then routes to Atlas. Payload is encoded
  // JSON in the SAME snake_case shape the web hand-off parser expects (see
  // CompanionClient.parseHandoffFromHash) so no field is silently dropped.
  // No tokens; redacted content only (content.js already redacted it).
  function fallbackLink(base, assistantId, taskId, capture) {
    const payload = buildCapturePayload(assistantId, taskId, capture);
    const encoded = encodeURIComponent(JSON.stringify(payload));
    return base + Config.WEB_FALLBACK_PATH + "#payload=" + encoded;
  }

  async function openTab(url) {
    try {
      await chrome.tabs.create({ url });
      return true;
    } catch (_e) {
      // Last resort for contexts where tabs.create is unavailable.
      try {
        window.open(url, "_blank", "noopener");
        return true;
      } catch (_e2) {
        return false;
      }
    }
  }

  // STEP 1 of the review-before-send gate. Capture the active tab and build the
  // EXACT payload + seeded prompt WITHOUT any fetch or tab open. The side panel
  // renders this into a review pane and waits for an explicit confirm before
  // calling sendCapture(). Returns { ok, capture, payload, seededPrompt,
  // assistant, task } or { ok:false, error }.
  async function captureForReview(assistantId, taskId) {
    await Config.setLastAssistant(assistantId);

    let capture;
    try {
      capture = await captureActiveTab();
    } catch (e) {
      return { ok: false, error: (e && e.message) || "capture_failed" };
    }

    const assistant = assistantById(assistantId);
    const task = taskById(taskId);
    const seededPrompt = buildSeededPrompt(assistantId, taskId, capture);
    const payload = buildCapturePayload(assistantId, taskId, capture);

    return {
      ok: true,
      assistantId,
      taskId,
      capture,
      payload,
      seededPrompt,
      assistant,
      task,
    };
  }

  // STEP 2 of the gate. Given an already-captured payload (from
  // captureForReview), POST it, fall back to the web hand-off on failure, then
  // open the right LegendsOS tab. NO capture happens here — the user already
  // reviewed exactly this payload. Returns { ok, mode, seededPrompt, openedUrl,
  // opened, captureId } or { ok:false, error }.
  async function sendCapture(assistantId, taskId, capture) {
    const base = await Config.getBaseUrl();
    const seededPrompt = buildSeededPrompt(assistantId, taskId, capture);

    // Try direct authenticated POST first (preferred).
    try {
      const result = await postCapture(base, assistantId, taskId, capture);
      const openUrl =
        result.routingLink || atlasLink(base, result.seededPrompt || seededPrompt);
      const opened = await openTab(openUrl);
      return {
        ok: true,
        mode: "direct",
        seededPrompt: result.seededPrompt || seededPrompt,
        openedUrl: openUrl,
        opened,
        captureId: result.captureId,
      };
    } catch (e) {
      if (e && e.unauthed) {
        return { ok: false, error: "unauthed" };
      }
      // Fall back to the web hand-off: the authenticated web app saves it.
      // Prefer any routing href the server already returned (setup_needed case).
      const url =
        (e && e.routingLink) || fallbackLink(base, assistantId, taskId, capture);
      const opened = await openTab(url);
      return {
        ok: true,
        mode: "fallback",
        seededPrompt,
        openedUrl: url,
        opened,
        captureId: null,
      };
    }
  }

  // One-shot runner (capture + send) for surfaces without a review pane (e.g.
  // the toolbar popup). The side panel uses the two-step gate instead.
  async function runAction(assistantId, taskId) {
    const reviewed = await captureForReview(assistantId, taskId);
    if (!reviewed.ok) return reviewed;
    return sendCapture(assistantId, taskId, reviewed.capture);
  }

  // Local-only action: produce output text in the panel WITHOUT routing.
  // Used for "Draft note" / "Find missing items" / etc. preview in the output
  // box. This is honest scaffolding: the companion assembles a structured,
  // copyable draft from the captured context locally; full AI completion
  // happens when the user opens it in Atlas. We never claim a model ran here.
  function buildLocalDraft(taskId, capture) {
    const task = taskById(taskId);
    const summary =
      (capture.structuredContext && capture.structuredContext.summary) || "";
    const lines = [];
    lines.push("[" + task.label + " — draft from captured context]");
    lines.push("");
    lines.push("Source: " + (capture.sourceTitle || "(untitled)"));
    lines.push(capture.sourceUrl);
    lines.push("");
    if (summary) {
      lines.push(summary);
    } else if (capture.selectedText) {
      lines.push(capture.selectedText);
    } else {
      lines.push("(No text was captured from this page.)");
    }
    lines.push("");
    lines.push(
      "Open in LegendsOS (Atlas) to turn this into a finished " +
        task.label.toLowerCase() +
        "."
    );
    return lines.join("\n");
  }

  globalThis.LegendsOSCompanion = {
    TASKS,
    FRAMING,
    assistantById,
    taskById,
    assistantEnumFor,
    buildCapturePayload,
    buildSeededPrompt,
    checkSession,
    captureActiveTab,
    captureForReview,
    sendCapture,
    postCapture,
    atlasLink,
    fallbackLink,
    openTab,
    runAction,
    buildLocalDraft,
  };
})();
