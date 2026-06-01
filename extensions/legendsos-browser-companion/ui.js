/**
 * LegendsOS Browser Companion — ui.js (shared UI controller)
 *
 * Wires the DOM in sidepanel.html / popup.html to companion.js logic.
 * Both sidepanel.js and popup.js call LegendsOSUI.init().
 *
 * No tokens, no secrets. All network calls go through companion.js, which uses
 * the user's session cookie via credentials:'include'.
 *
 * Loaded after config.js + companion.js.
 */

(function () {
  "use strict";

  const Config = globalThis.LegendsOSConfig;
  const Companion = globalThis.LegendsOSCompanion;

  function $(id) {
    return document.getElementById(id);
  }

  function setToast(msg, kind) {
    const el = $("toast");
    if (!el) return;
    el.textContent = msg || "";
    el.className = "toast" + (kind ? " " + kind : "");
  }

  function setStatus(status, base) {
    const pill = $("status");
    const text = $("status-text");
    const authCard = $("auth-card");
    const authDetail = $("auth-detail");
    const authAction = $("auth-action");
    if (!pill || !text) return;

    pill.className = "status";
    let label = "Checking…";
    let showAuth = false;
    let detail = "";
    let actionLabel = "";
    let actionHref = "#";

    switch (status) {
      case "authed":
        pill.classList.add("authed");
        label = "Connected";
        break;
      case "unauthed":
        pill.classList.add("unauthed");
        label = "Sign in needed";
        showAuth = true;
        detail = "You are not signed in to LegendsOS in this browser.";
        actionLabel = "Sign in to LegendsOS";
        actionHref = base + "/login";
        break;
      case "setupNeeded":
        pill.classList.add("setup");
        label = "Setup needed";
        showAuth = true;
        detail =
          "The companion backend isn't provisioned yet (database migration not applied). Capture will fall back to opening LegendsOS directly.";
        actionLabel = "Open LegendsOS";
        actionHref = base;
        break;
      case "unreachable":
      default:
        pill.classList.add("unreachable");
        label = "Can't reach LegendsOS";
        showAuth = true;
        detail =
          "Couldn't reach " +
          base +
          ". Check the base URL in Settings, or your connection.";
        actionLabel = "Open LegendsOS";
        actionHref = base;
        break;
    }

    text.textContent = label;
    if (authCard) authCard.hidden = !showAuth;
    if (authDetail) authDetail.textContent = detail;
    if (authAction) {
      authAction.textContent = actionLabel;
      authAction.href = actionHref;
    }
  }

  function populateAssistants(selected) {
    const sel = $("assistant");
    if (!sel) return;
    sel.innerHTML = "";
    for (const a of Config.ASSISTANTS) {
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = "Send to " + a.label;
      if (a.id === selected) opt.selected = true;
      sel.appendChild(opt);
    }
  }

  async function refreshPageMeta() {
    const titleEl = $("page-title");
    const urlEl = $("page-url");
    const badge = $("page-badge");
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab) {
        if (titleEl) titleEl.textContent = "(no active tab)";
        return;
      }
      const title = tab.title || "(untitled)";
      const url = tab.url || "";
      let host = "";
      try {
        host = url ? new URL(url).hostname : "";
      } catch (_e) {
        host = "";
      }
      if (titleEl) titleEl.textContent = title;
      if (urlEl) urlEl.textContent = url;
      if (badge) {
        if (Config.isSupportedPortalHost(host)) {
          badge.hidden = false;
          badge.textContent = "Supported portal page";
          badge.className = "badge supported";
        } else if (host) {
          badge.hidden = false;
          badge.textContent = host;
          badge.className = "badge";
        } else {
          badge.hidden = true;
        }
      }
    } catch (_e) {
      if (titleEl) titleEl.textContent = "(page unavailable)";
    }
  }

  function selectedAssistant() {
    const sel = $("assistant");
    return (sel && sel.value) || Config.ASSISTANTS[0].id;
  }

  function setOutput(text) {
    const out = $("output");
    const copyBtn = $("copy-btn");
    if (out) out.value = text || "";
    if (copyBtn) copyBtn.disabled = !text;
  }

  let lastOpenUrl = null;
  function setOpenUrl(url) {
    lastOpenUrl = url || null;
    const openBtn = $("open-btn");
    if (openBtn) openBtn.disabled = !url;
  }

  function disableActions(disabled) {
    document
      .querySelectorAll("button[data-action]")
      .forEach((b) => (b.disabled = disabled));
  }

  function describeCaptureError(code) {
    switch (code) {
      case "no_active_tab":
        return "No active tab to capture.";
      case "unsupported_page":
        return "This page can't be captured (browser/internal page).";
      case "inject_failed":
        return "Couldn't access this page. Try a portal page or reload.";
      case "unauthed":
        return "Sign in to LegendsOS first, then try again.";
      default:
        return "Capture failed. Try reloading the page.";
    }
  }

  // The currently-staged-but-unsent capture (review-before-send gate). Set by a
  // data-action click when the review pane exists; cleared on send/cancel.
  let pendingReview = null;

  function reviewPaneExists() {
    return Boolean($("review-card"));
  }

  // Render the EXACT payload into the review pane and reveal it. NO network call
  // or tab open happens here — the user must click "Send to LegendsOS".
  function showReview(reviewed) {
    const card = $("review-card");
    if (!card) return;
    const payload = reviewed.payload || {};

    const titleEl = $("review-title");
    if (titleEl)
      titleEl.textContent = payload.source_title || "(untitled page)";
    const urlEl = $("review-url");
    if (urlEl) urlEl.textContent = payload.source_url || "(no URL captured)";

    const selWrap = $("review-selected-wrap");
    const selBox = $("review-selected");
    const selText = payload.selected_text || "";
    if (selWrap) selWrap.hidden = !selText;
    if (selBox) selBox.value = selText;

    const structWrap = $("review-structured-wrap");
    const structBox = $("review-structured");
    let structText = "";
    const sc = payload.structured_context;
    if (sc && typeof sc === "object") {
      const items = Array.isArray(sc.items) ? sc.items : [];
      if (items.length) {
        structText = items
          .map((i) => "• " + (i.kind ? i.kind + ": " : "") + (i.text || ""))
          .join("\n");
      } else if (sc.summary) {
        structText = String(sc.summary);
      }
    }
    if (structWrap) structWrap.hidden = !structText;
    if (structBox) structBox.value = structText;

    const promptBox = $("review-prompt");
    if (promptBox) promptBox.value = reviewed.seededPrompt || "";

    card.hidden = false;
  }

  function hideReview() {
    pendingReview = null;
    const card = $("review-card");
    if (card) card.hidden = true;
  }

  // STEP 1: capture the page and stage it for review (no send). Used when the
  // review pane exists (side panel).
  async function captureForReview(taskId) {
    const assistantId = selectedAssistant();
    setToast("Capturing page…", null);
    disableActions(true);
    setOpenUrl(null);
    hideReview();

    try {
      const reviewed = await Companion.captureForReview(assistantId, taskId);
      if (!reviewed.ok) {
        if (reviewed.error === "unauthed") {
          setToast("Sign in to LegendsOS first.", "warn");
          await runSessionCheck();
        } else {
          setToast(describeCaptureError(reviewed.error), "err");
        }
        return;
      }
      pendingReview = reviewed;
      // Show the seeded prompt in the output box too so it's copyable.
      setOutput(reviewed.seededPrompt || "");
      showReview(reviewed);
      setToast("Review the captured payload below, then send.", null);
    } catch (e) {
      setToast(describeCaptureError((e && e.message) || ""), "err");
    } finally {
      disableActions(false);
    }
  }

  // STEP 2: the user confirmed — send the already-reviewed capture.
  async function confirmSend() {
    if (!pendingReview) return;
    const reviewed = pendingReview;
    setToast("Sending to LegendsOS…", null);
    disableActions(true);
    const sendBtn = $("review-send");
    if (sendBtn) sendBtn.disabled = true;

    try {
      const result = await Companion.sendCapture(
        reviewed.assistantId,
        reviewed.taskId,
        reviewed.capture
      );
      if (!result.ok) {
        if (result.error === "unauthed") {
          setToast("Sign in to LegendsOS first.", "warn");
          await runSessionCheck();
        } else {
          setToast(describeCaptureError(result.error), "err");
        }
        return;
      }

      setOutput(result.seededPrompt || reviewed.seededPrompt || "");
      setOpenUrl(result.openedUrl || null);
      hideReview();

      if (result.mode === "direct") {
        setToast(
          result.opened
            ? "Sent and saved. Opened LegendsOS."
            : "Sent and saved. Use “Open in LegendsOS”.",
          "ok"
        );
      } else {
        setToast(
          result.opened
            ? "Direct save unavailable — opened LegendsOS to finish saving."
            : "Direct save unavailable — use “Open in LegendsOS”.",
          "warn"
        );
      }
    } catch (e) {
      setToast(describeCaptureError((e && e.message) || ""), "err");
    } finally {
      disableActions(false);
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  // One-shot capture+send for surfaces WITHOUT a review pane (e.g. the popup).
  async function runOneShot(taskId) {
    const assistantId = selectedAssistant();
    setToast("Capturing page…", null);
    disableActions(true);
    setOpenUrl(null);

    try {
      const result = await Companion.runAction(assistantId, taskId);
      if (!result.ok) {
        if (result.error === "unauthed") {
          setToast("Sign in to LegendsOS first.", "warn");
          await runSessionCheck();
        } else {
          setToast(describeCaptureError(result.error), "err");
        }
        return;
      }

      setOutput(result.seededPrompt || "");
      setOpenUrl(result.openedUrl || null);

      if (result.mode === "direct") {
        setToast(
          result.opened
            ? "Captured and saved. Opened LegendsOS."
            : "Captured and saved. Use “Open in LegendsOS”.",
          "ok"
        );
      } else {
        setToast(
          result.opened
            ? "Direct save unavailable — opened LegendsOS to finish saving."
            : "Direct save unavailable — use “Open in LegendsOS”.",
          "warn"
        );
      }
    } catch (e) {
      setToast(describeCaptureError((e && e.message) || ""), "err");
    } finally {
      disableActions(false);
    }
  }

  // Route a task-button click. With a review pane present, this only CAPTURES
  // and stages a review; the send happens on explicit confirm. Without a review
  // pane (popup), it's the one-shot capture+send.
  async function handleAction(taskId) {
    if (reviewPaneExists()) {
      await captureForReview(taskId);
    } else {
      await runOneShot(taskId);
    }
  }

  async function runSessionCheck() {
    const base = await Config.getBaseUrl();
    const urlInput = $("base-url");
    if (urlInput && !urlInput.value) urlInput.value = base;
    setStatus("checking", base);
    const res = await Companion.checkSession();
    setStatus(res.status, res.base);
  }

  function bindEvents() {
    document.querySelectorAll("button[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => handleAction(btn.dataset.action));
    });

    // Review-before-send confirm / cancel (side panel only — absent in popup).
    const reviewSend = $("review-send");
    if (reviewSend) {
      reviewSend.addEventListener("click", () => confirmSend());
    }
    const reviewCancel = $("review-cancel");
    if (reviewCancel) {
      reviewCancel.addEventListener("click", () => {
        hideReview();
        setToast("Capture discarded — nothing was sent.", null);
      });
    }

    const copyBtn = $("copy-btn");
    if (copyBtn) {
      copyBtn.addEventListener("click", async () => {
        const out = $("output");
        const text = (out && out.value) || "";
        if (!text) return;
        try {
          await navigator.clipboard.writeText(text);
          setToast("Copied to clipboard.", "ok");
        } catch (_e) {
          // Fallback for restricted clipboard contexts.
          if (out) {
            out.removeAttribute("readonly");
            out.select();
            try {
              document.execCommand("copy");
              setToast("Copied to clipboard.", "ok");
            } catch (_e2) {
              setToast("Couldn't copy — select and copy manually.", "warn");
            }
            out.setAttribute("readonly", "readonly");
          }
        }
      });
    }

    const openBtn = $("open-btn");
    if (openBtn) {
      openBtn.addEventListener("click", async () => {
        if (!lastOpenUrl) return;
        await Companion.openTab(lastOpenUrl);
      });
    }

    const saveUrl = $("save-url");
    if (saveUrl) {
      saveUrl.addEventListener("click", async () => {
        const input = $("base-url");
        const next = await Config.setBaseUrl(input ? input.value : "");
        if (input) input.value = next;
        setToast("Base URL saved.", "ok");
        await runSessionCheck();
      });
    }

    const recheck = $("recheck");
    if (recheck) {
      recheck.addEventListener("click", () => runSessionCheck());
    }

    const assistant = $("assistant");
    if (assistant) {
      assistant.addEventListener("change", () => {
        Config.setLastAssistant(assistant.value);
        // A staged review was built for the previously-selected assistant; the
        // routing/framing would now be stale, so discard it (re-capture to send
        // to the new target). Nothing was ever sent.
        if (pendingReview) {
          hideReview();
          setToast(
            "Route changed — re-capture to send to the new assistant.",
            null
          );
        }
      });
    }
  }

  async function init() {
    const base = await Config.getBaseUrl();
    const urlInput = $("base-url");
    if (urlInput) urlInput.value = base;

    const lastAssistant = await Config.getLastAssistant();
    populateAssistants(lastAssistant);

    bindEvents();
    await refreshPageMeta();
    await runSessionCheck();
  }

  globalThis.LegendsOSUI = { init };
})();
