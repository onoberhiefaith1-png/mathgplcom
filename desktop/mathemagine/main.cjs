// Mathemagine desktop app: the main Mathemagine website (mathgpl.com) in its
// own window. This is NOT the offline Academia app (desktop/academia), and it
// uses different identifiers everywhere (app id, data folder, install folder,
// uninstall key, shortcut) so installing one never replaces the other.
const { app, BrowserWindow, shell, dialog } = require("electron");
const path = require("path");

const PRODUCT = "Mathemagine";
// Distinct from desktop/academia, which already uses "Mathemagine" for these.
const DATA_FOLDER = "Mathemagine Platform";
const APP_USER_MODEL_ID = "com.mathgpl.mathemagine.platform";

app.setName(PRODUCT);
app.setPath("userData", path.join(app.getPath("appData"), DATA_FOLDER));
if (process.platform === "win32") app.setAppUserModelId(APP_USER_MODEL_ID);

const ORIGIN = "https://mathgpl.com";
const START = `${ORIGIN}/?source=mathemagine-desktop`;
const LATEST = `${ORIGIN}/desktop/mathemagine-latest.json`;
// Sign-in may pass through these hosts and must stay inside the window.
const AUTH_HOSTS = [/\.supabase\.co$/, /^accounts\.google\.com$/, /^appleid\.apple\.com$/, /^login\.microsoftonline\.com$/];
const allowed = (u) => {
  try {
    const x = new URL(u);
    if (x.origin === ORIGIN || x.origin === "https://www.mathgpl.com") return true;
    return x.protocol === "https:" && AUTH_HOSTS.some((h) => h.test(x.hostname));
  } catch { return false; }
};
const newer = (a, b) => { const p = (v) => String(v).split(".").map((n) => parseInt(n, 10) || 0); const x = p(a), y = p(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };

async function checkForUpdate(win) {
  try {
    const r = await fetch(LATEST, { cache: "no-store" });
    if (!r.ok) return;
    const j = await r.json();
    const key = process.platform === "win32" ? "windows" : process.arch === "arm64" ? "mac-arm" : "mac-intel";
    const url = j?.[key]?.url;
    if (!j?.version || !newer(j.version, app.getVersion()) || typeof url !== "string" || !url.startsWith("https://")) return;
    const { response } = await dialog.showMessageBox(win, { type: "info", buttons: ["Download", "Later"], defaultId: 1, title: PRODUCT, message: `${PRODUCT} ${j.version} is available.` });
    if (response === 0) void shell.openExternal(url);
  } catch { /* offline: try next launch */ }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 900, title: PRODUCT, icon: path.join(__dirname, "icon.png"), autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (allowed(url)) return { action: "allow" };
    void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!allowed(url) && !url.startsWith("file:")) { e.preventDefault(); void shell.openExternal(url); }
  });
  win.webContents.on("did-fail-load", (_e, code, _d, url) => {
    if (code !== -3 && url.startsWith("https://")) void win.loadFile(path.join(__dirname, "offline.html"));
  });
  win.on("page-title-updated", (e) => { e.preventDefault(); win.setTitle(PRODUCT); });
  void win.loadURL(START);
  setTimeout(() => void checkForUpdate(win), 60_000);
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
  app.whenReady().then(createWindow);
  app.on("window-all-closed", () => app.quit());
}
