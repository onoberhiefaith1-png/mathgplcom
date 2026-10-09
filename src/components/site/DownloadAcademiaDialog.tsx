/** Front-page device picker for installing the offline Academia app. */
import { useEffect, useState } from "react";
import { Apple, Laptop, Monitor, Smartphone, X } from "lucide-react";
import { installTargetFor } from "@/lib/offline/installTarget";

type InstallEvent = Event & { prompt: () => Promise<void> };
let deferred: InstallEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as InstallEvent; });
}

type Device = "android" | "ios" | "windows" | "mac";
const DEVICES: { id: Device; label: string; icon: typeof Apple; steps: string[] }[] = [
  { id: "android", label: "Android", icon: Smartphone, steps: ["Tap Download Android app below.", "Open the downloaded file and tap Install (allow installs from your browser if asked)."] },
  { id: "ios", label: "iPhone / iPad", icon: Apple, steps: ["Tap Install on iPhone below (use Safari).", "Follow the three taps shown: Share, Add to Home Screen, Add.", "Open Academia from its new icon once with internet. After that it works with no data."] },
  { id: "windows", label: "Windows", icon: Monitor, steps: ["Open in Chrome or Edge.", "Click Install in the top bar."] },
  { id: "mac", label: "MacBook", icon: Laptop, steps: ["Open in Chrome or Edge.", "Click Install in the address bar. (Safari: File → Add to Dock.)"] },
];

const btn = "mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-amber-400 font-semibold text-slate-900 hover:bg-amber-300";

export default function DownloadAcademiaDialog({ onClose }: { onClose: () => void }) {
  const [pick, setPick] = useState<Device | null>(null);
  const chosen = DEVICES.find((d) => d.id === pick);
  useEffect(() => {
    // Pre-select this device so phones see their own steps first.
    const t = installTargetFor(navigator.userAgent, navigator.maxTouchPoints, navigator.platform);
    setPick(t === "android" ? "android" : t.startsWith("ios") ? "ios" : /mac/i.test(navigator.userAgent) ? "mac" : "windows");
    // Where the browser allows it, Download installs the app in one click.
    if (deferred && t !== "android") { const d = deferred; deferred = null; void d.prompt().then(onClose); }
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Download Academia" className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[hsl(224_70%_9%)] p-6 text-white shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <img src="/academia-icon-192.png" alt="" width={40} height={40} className="h-10 w-10 rounded-xl" />
          <div className="flex-1">
            <h2 className="text-lg font-bold">Download Academia</h2>
            <p className="text-sm text-white/60">Works offline once installed. No account needed.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-full p-2 hover:bg-white/10"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {DEVICES.map((d) => (
            <button key={d.id} type="button" onClick={() => setPick(d.id)} aria-pressed={pick === d.id}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition ${pick === d.id ? "border-amber-400 bg-amber-400/10" : "border-white/15 hover:border-white/40"}`}>
              <d.icon className="h-7 w-7" />
              <span className="text-sm font-semibold">{d.label}</span>
            </button>
          ))}
        </div>
        {chosen && (
          <div className="mt-4 rounded-xl bg-white/5 p-4 text-sm">
            <ol className="list-decimal space-y-1 pl-5 text-white/80">
              {chosen.steps.map((s) => <li key={s}>{s}</li>)}
            </ol>
            {chosen.id === "android" && <a href="/mathgpl-academia.apk" download className={btn}>Download Android app (.apk)</a>}
            {/* The Home Screen app must be added from the Academia page itself, so it opens Academia. */}
            {chosen.id === "ios" && <a href="/academia-app?install=1" className={btn}>Install on iPhone</a>}
            {(chosen.id === "windows" || chosen.id === "mac") && <a href="/academia-app" className={btn}>Open Academia to install</a>}
          </div>
        )}
      </div>
    </div>
  );
}
