// Mathemagine desktop app: opens the Mathemagine (Academia) student app only.
// Its offline worker caches the app and saved schools on first open, so later
// launches work with no internet. Data lives in a fixed "Mathemagine" app-data
// folder, separate from program files, so upgrades and reinstalls keep it.
const { app, BrowserWindow, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

app.setName("Mathemagine");
const DATA = path.join(app.getPath("appData"), "Mathemagine");
// One-time move of an older "MathGPL Academia"/"mathgpl-academia" profile.
try {
  if (!fs.existsSync(DATA)) {
    for (const old of ["MathGPL Academia", "mathgpl-academia"]) {
      const p = path.join(app.getPath("appData"), old);
      if (fs.existsSync(p)) { fs.cpSync(p, DATA, { recursive: true }); break; }
    }
  }
} catch { /* start fresh if the copy fails */ }
app.setPath("userData", DATA);
if (process.platform === "win32") app.setAppUserModelId("com.mathgpl.mathemagine");

const START = "https://mathgpl.com/academia-app";
const LATEST = "https://mathgpl.com/desktop/latest.json";
const allowed = (u) => { try { const x = new URL(u); return x.origin === "https://mathgpl.com" && (x.pathname.startsWith("/academia-app") || x.pathname.startsWith("/api/public/academia")); } catch { return false; } };
const newer = (a, b) => { const p = (v) => String(v).split(".").map((n) => parseInt(n, 10) || 0); const x = p(a), y = p(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };

// Quiet check for a newer installer; never interrupts, never self-installs.
async function checkForUpdate(win) {
  try {
    const r = await fetch(LATEST, { cache: "no-store" });
    if (!r.ok) return;
    const j = await r.json();
    const key = process.platform === "win32" ? "windows" : process.arch === "arm64" ? "mac-arm" : "mac-intel";
    const url = j?.[key]?.url;
    if (!j?.version || !newer(j.version, app.getVersion()) || typeof url !== "string" || !url.startsWith("https://")) return;
    const { response } = await dialog.showMessageBox(win, { type: "info", buttons: ["Download", "Later"], defaultId: 1, title: "Mathemagine", message: `Mathemagine ${j.version} is available.`, detail: "Your saved schools and progress stay when you install it." });
    if (response === 0) void shell.openExternal(url);
  } catch { /* offline: try next launch */ }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 860, title: "Mathemagine", icon: path.join(__dirname, "icon.png"), autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.webContents.setWindowOpenHandler(({ url }) => { if (!allowed(url)) void shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => { if (!allowed(url) && !url.startsWith("file:")) { e.preventDefault(); void shell.openExternal(url); } });
  win.webContents.on("did-fail-load", (_e, code, _d, url) => { if (code !== -3 && url.startsWith("https://")) void win.loadFile(path.join(__dirname, "offline.html")); });
  win.on("page-title-updated", (e) => { e.preventDefault(); win.setTitle("Mathemagine"); });
  void win.loadURL(START);
  setTimeout(() => void checkForUpdate(win), 60_000);
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
  app.whenReady().then(createWindow);
  app.on("window-all-closed", () => app.quit());
}
