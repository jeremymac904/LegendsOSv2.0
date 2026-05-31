// LegendsOS desktop shell.
//
// This is a thin Electron wrapper around the hosted LegendsOS Next.js app.
// The web app is the source of truth — login, session, every page, every
// API route — and this process just renders it inside a native window with
// LegendsOS branding.
//
// Why so minimal:
//   - Auth + session live in Supabase cookies, which the embedded Chromium
//     handles transparently. No custom auth bridge needed.
//   - File uploads / downloads use the standard webContents flow.
//   - Updates happen on the hosted side — when Netlify deploys, the next
//     window load picks it up.
//
// To swap targets (e.g. point at a local dev server), set:
//   LEGENDSOS_DESKTOP_URL=http://localhost:3000

const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("path");

const DEFAULT_URL = "https://legndsosv20.netlify.app";
const APP_NAME = "LegendsOS";

// Single-instance lock. If the user double-clicks the icon while the app
// is already open, we focus the existing window instead of spawning a new
// one. macOS handles this natively for click-on-dock, but command-line /
// keyboard launches still benefit from the explicit lock.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  return;
}

app.name = APP_NAME;
app.setName(APP_NAME);

function createMainWindow() {
  const url = process.env.LEGENDSOS_DESKTOP_URL || DEFAULT_URL;
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 760,
    title: APP_NAME,
    backgroundColor: "#0a0a0d",
    autoHideMenuBar: true,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition:
      process.platform === "darwin" ? { x: 18, y: 18 } : undefined,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: true,
    },
  });

  // Wait for first paint before showing — eliminates the white flash on
  // dark mode while Chromium boots.
  win.once("ready-to-show", () => win.show());

  // Any window.open / target=_blank link should open in the user's real
  // browser, not a stripped-down child BrowserWindow. The exception is
  // the LegendsOS domain itself — we let those navigate in place.
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    try {
      const t = new URL(target);
      const here = new URL(url);
      if (t.host === here.host) {
        return { action: "allow" };
      }
    } catch (_err) {
      // fall through and treat as external
    }
    shell.openExternal(target);
    return { action: "deny" };
  });

  // Catch the cross-domain plain-navigation case too — clicking a link
  // that hard-navigates to another origin should bounce out to the user's
  // default browser rather than turning this shell into a generic browser.
  win.webContents.on("will-navigate", (event, target) => {
    try {
      const t = new URL(target);
      const here = new URL(url);
      if (t.host !== here.host) {
        event.preventDefault();
        shell.openExternal(target);
      }
    } catch (_err) {
      // ignore — let Electron handle malformed URLs
    }
  });

  win.loadURL(url);
  return win;
}

// Trim the default menu down to essentials. On macOS we keep the standard
// app / edit / view / window roles; on Windows/Linux we collapse to a
// compact menu so the chrome stays minimal.
function buildMenu() {
  const template =
    process.platform === "darwin"
      ? [
          {
            label: APP_NAME,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
          {
            label: "Edit",
            submenu: [
              { role: "undo" },
              { role: "redo" },
              { type: "separator" },
              { role: "cut" },
              { role: "copy" },
              { role: "paste" },
              { role: "pasteAndMatchStyle" },
              { role: "selectAll" },
            ],
          },
          {
            label: "View",
            submenu: [
              { role: "reload" },
              { role: "forceReload" },
              { type: "separator" },
              { role: "resetZoom" },
              { role: "zoomIn" },
              { role: "zoomOut" },
              { type: "separator" },
              { role: "togglefullscreen" },
            ],
          },
          {
            label: "Window",
            submenu: [
              { role: "minimize" },
              { role: "zoom" },
              { type: "separator" },
              { role: "front" },
            ],
          },
        ]
      : [
          {
            label: "File",
            submenu: [{ role: "quit" }],
          },
          {
            label: "Edit",
            submenu: [
              { role: "undo" },
              { role: "redo" },
              { type: "separator" },
              { role: "cut" },
              { role: "copy" },
              { role: "paste" },
              { role: "selectAll" },
            ],
          },
          {
            label: "View",
            submenu: [
              { role: "reload" },
              { role: "forceReload" },
              { type: "separator" },
              { role: "resetZoom" },
              { role: "zoomIn" },
              { role: "zoomOut" },
              { type: "separator" },
              { role: "togglefullscreen" },
            ],
          },
        ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.on("second-instance", () => {
  const wins = BrowserWindow.getAllWindows();
  if (wins.length > 0) {
    const w = wins[0];
    if (w.isMinimized()) w.restore();
    w.focus();
  }
});

app.whenReady().then(() => {
  buildMenu();
  createMainWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
