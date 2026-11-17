// Safe bridge: the page can ask this window to drop its HTTP and service-worker
// caches. It cannot clear cookies, login, localStorage or IndexedDB (lesson packs).
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("mathgplDesktop", {
  clearWebCache: () => ipcRenderer.invoke("mathgpl:clear-web-cache"),
});
