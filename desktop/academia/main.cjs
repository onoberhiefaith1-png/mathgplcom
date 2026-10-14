// MathGPL Academia desktop app: opens Academia only, never the full MathGPL site.
// Academia's own offline worker caches the app and saved schools on first open,
// so later launches work with no internet; data lives in this app's own profile.
const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const START = "https://mathgpl.com/academia-app";
const allowed = (u) => { try { const x = new URL(u); return x.origin === "https://mathgpl.com" && (x.pathname.startsWith("/academia-app") || x.pathname.startsWith("/api/public/academia")); } catch { return false; } };

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 860, title: "MathGPL Academia", icon: path.join(__dirname, "icon.png"), autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.webContents.setWindowOpenHandler(({ url }) => { if (!allowed(url)) void shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => { if (!allowed(url) && !url.startsWith("file:")) { e.preventDefault(); void shell.openExternal(url); } });
  // First launch with no internet and nothing cached yet: show a friendly page.
  win.webContents.on("did-fail-load", (_e, code, _d, url) => { if (code !== -3 && url.startsWith("https://")) void win.loadFile(path.join(__dirname, "offline.html")); });
  void win.loadURL(START);
}
app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
