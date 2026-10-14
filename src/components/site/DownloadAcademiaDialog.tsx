/** Front-page device picker for installing the offline Academia app. */
import { useEffect, useState } from "react";
import { Apple, Laptop, Monitor, Smartphone, X } from "lucide-react";
import { installTargetFor } from "@/lib/offline/installTarget";
import { releasesFor, sizeLabel, type Release } from "@/lib/offline/releases";

type InstallEvent = Event & { prompt: () => Promise<void> };
let deferred: InstallEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as InstallEvent; });
}

type Device = "android" | "ios" | "windows" | "mac";
const DEVICES: { id: Device; label: string; icon: typeof Apple; steps: string[] }[] = [
  { id: "android", label: "Android", icon: Smartphone, steps: ["Tap Download APK below.", "Open the downloaded file and tap Install (allow installs from your browser if asked)."] },
  { id: "ios", label: "iPhone / iPad", icon: Apple, steps: ["Tap Install Academia below (use Safari).", "Follow the three taps shown: Share, Add to Home Screen, Add.", "Open Academia from its new icon once with internet. After that it works with no data."] },
  { id: "windows", label: "Windows", icon: Monitor, steps: ["Download the Windows app and unzip it (right-click, Extract All).", "Open the folder and double-click MathGPL Academia.exe.", "If Windows says \"Windows protected your PC\", click More info, then Run anyway.", "Open it once with internet; after that it works with no data."] },
  { id: "mac", label: "MacBook", icon: Laptop, steps: ["Pick Apple chip (M1 or newer) or Intel, then open the downloaded zip.", "Drag MathGPL Academia into Applications.", "The first time, right-click the app and choose Open, then Open again.", "Open it once with internet; after that it works with no data."] },
];

const btn = "mt-4 inline-flex min-h-[48px] w-full flex-col items-center justify-center rounded-full bg-amber-400 px-4 py-1 font-semibold text-slate-900 hover:bg-amber-300";
const meta = (r: Release) => `Version ${r.version} · ${sizeLabel(r.bytes)} · built ${r.builtAt}`;
const ReleaseLink = ({ r }: { r: Release }) => (
  <a href={r.url} download={r.file} className={btn}>
    <span>{r.label}</span>
    <span className="text-xs font-normal opacity-70">{meta(r)}</span>
  </a>
);

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
            {chosen.id === "android" && releasesFor("android").map((r) => <ReleaseLink key={r.file} r={r} />)}
            {/* The Home Screen app must be added from the Academia page itself, so it opens Academia. */}
            {chosen.id === "ios" && <a href="/academia-app?install=1" className={btn}>Install Academia</a>}
            {chosen.id === "windows" && releasesFor("windows").map((r) => <ReleaseLink key={r.file} r={r} />)}
            {chosen.id === "mac" && releasesFor("mac").map((r) => <ReleaseLink key={r.file} r={r} />)}
            {chosen.id === "mac" && <a href="/academia-app" className="mt-3 block text-center text-white/70 underline">Or install from Chrome or Edge instead</a>}
          </div>
        )}
      </div>
    </div>
  );
}
