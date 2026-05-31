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

  async function handleAction(taskId) {
    const assistantId = selectedAssistant();
    setToast("Capturing page…", null);
    disableActions(true);
    setOpenUrl(null);

    // For the two "local draft" tasks we still capture, show a local preview in
    // the output box, AND route to Atlas so the user gets a real completion.
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

      // Show the seeded prompt in the read-only output box so the user can copy
      // it even if the tab didn't open.
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
      assistant.addEventListener("change", () =>
        Config.setLastAssistant(assistant.value)
      );
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
