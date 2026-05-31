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

  // POST the capture to LegendsOS. On success returns { routedTo, captureId? }.
  // On network/CORS failure throws so the caller can fall back to the hand-off.
  async function postCapture(base, assistantId, taskId, capture) {
    const assistant = assistantById(assistantId);
    const task = taskById(taskId);
    const seededPrompt = buildSeededPrompt(assistantId, taskId, capture);

    const payload = {
      sourceUrl: capture.sourceUrl,
      sourceTitle: capture.sourceTitle,
      sourceDomain: capture.sourceDomain,
      selectedText: capture.selectedText,
      structuredContext: capture.structuredContext,
      routedAssistant: assistant.id,
      framing: assistant.framing,
      task: task.id,
      taskLabel: task.label,
      seededPrompt,
    };

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
    return {
      captureId: (body && body.id) || null,
      // The server may return an explicit routing link; otherwise we build one.
      routingLink: (body && body.routingLink) || null,
      seededPrompt,
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
  // JSON (no tokens, redacted content only).
  function fallbackLink(base, assistantId, taskId, capture) {
    const assistant = assistantById(assistantId);
    const task = taskById(taskId);
    const seededPrompt = buildSeededPrompt(assistantId, taskId, capture);
    const payload = {
      sourceUrl: capture.sourceUrl,
      sourceTitle: capture.sourceTitle,
      sourceDomain: capture.sourceDomain,
      selectedText: capture.selectedText,
      structuredContext: capture.structuredContext,
      routedAssistant: assistant.id,
      framing: assistant.framing,
      task: task.id,
      seededPrompt,
    };
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

  // High-level "Send to X" / action runner. Captures, builds prompt, attempts
  // direct POST, falls back to hand-off, then opens the right LegendsOS tab.
  // Returns { ok, mode: 'direct'|'fallback', seededPrompt, openedUrl } or
  // { ok:false, error }.
  async function runAction(assistantId, taskId) {
    const base = await Config.getBaseUrl();
    await Config.setLastAssistant(assistantId);

    let capture;
    try {
      capture = await captureActiveTab();
    } catch (e) {
      return { ok: false, error: (e && e.message) || "capture_failed" };
    }

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
      const url = fallbackLink(base, assistantId, taskId, capture);
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
    buildSeededPrompt,
    checkSession,
    captureActiveTab,
    postCapture,
    atlasLink,
    fallbackLink,
    openTab,
    runAction,
    buildLocalDraft,
  };
})();
