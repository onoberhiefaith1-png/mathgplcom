/** The only place the offline Academia worker is registered. */
const blocked = () => {
  const h = window.location.hostname;
  return (
    !import.meta.env.PROD ||
    window.self !== window.top ||
    h.startsWith("id-preview--") ||
    h.startsWith("preview--") ||
    h === "lovableproject.com" || h.endsWith(".lovableproject.com") ||
    h === "lovableproject-dev.com" || h.endsWith(".lovableproject-dev.com") ||
    h === "beta.lovable.dev" || h.endsWith(".beta.lovable.dev") ||
    new URLSearchParams(window.location.search).get("sw") === "off"
  );
};

export async function registerAcademiaSW() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (blocked()) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.filter((r) => r.active?.scriptURL.endsWith("/sw.js")).map((r) => r.unregister()));
    return;
  }
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (e) {
    console.warn("Offline Academia worker not registered", e);
  }
}
