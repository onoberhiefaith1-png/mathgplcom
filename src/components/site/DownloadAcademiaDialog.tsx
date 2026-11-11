/** Front-page download page: the Mathemagine app (left) and the offline Academia app (right). Academia: copy it to the device, or download an app file. */
import { useEffect, useState } from "react";
import { Apple, Laptop, Monitor, Smartphone, X } from "lucide-react";
import { installTargetFor } from "@/lib/offline/installTarget";
import { releasesFor, sizeLabel, type Release } from "@/lib/offline/releases";
import MathemagineAppPanel from "@/components/site/MathemagineAppPanel";

type Device = "android" | "ios" | "windows" | "mac";
export type Mode = "copy" | "download";
type Info = { id: Device; label: string; icon: typeof Apple; copy: string[]; download: string[] };

/** Every device can copy Academia from the browser; iPhone/iPad has no download file. */
export const DEVICES: Info[] = [
  { id: "android", label: "Android", icon: Smartphone,
    copy: ["Tap Copy to phone below (use Chrome).", "Tap Install, or open the browser menu and choose Add to Home screen.", "Open Mathemagine from its new icon once with internet. After that it works with no data."],
    download: ["Tap Download APK below.", "Open the downloaded file and tap Install (allow installs from your browser if asked)."] },
  { id: "ios", label: "iPhone / iPad", icon: Apple,
    copy: ["Tap Copy to phone below (use Safari).", "Follow the three taps shown: Share, Add to Home Screen, Add.", "Open Mathemagine from its new icon once with internet. After that it works with no data."],
    download: [] },
  { id: "windows", label: "Windows", icon: Monitor,
    copy: ["Click Copy to computer below (use Chrome or Edge).", "Click Install, or the Install icon at the right of the address bar.", "Open it once with internet; after that it works with no data."],
    download: ["Click Download for Windows below (Windows 10 or 11, 64-bit).", "Open Mathemagine-Setup and click Next to install. No unzipping and no administrator password needed.", "Open Mathemagine from your desktop or Start menu once with internet; after that it works with no data.", "Mathemagine isn't signed yet, so Windows may show a blue screen: click More info, then Run anyway."] },
  { id: "mac", label: "MacBook", icon: Laptop,
    copy: ["Click Copy to computer below (use Chrome or Edge).", "Click Install, or the Install icon at the right of the address bar.", "Open it once with internet; after that it works with no data."],
    download: ["Unsigned preview for macOS 11 or newer. Pick Apple chip (M1 or newer) or Intel, then open the downloaded zip.", "Drag Mathemagine into Applications.", "The first time, right-click the app and choose Open, then Open again.", "Open it once with internet; after that it works with no data."] },
];

const btn = "mt-4 inline-flex min-h-[48px] w-full flex-col items-center justify-center rounded-full bg-amber-400 px-4 py-1 font-semibold text-slate-900 hover:bg-amber-300";
const meta = (r: Release) => `Version ${r.version} · ${sizeLabel(r.bytes)} · built ${r.builtAt}`;
const ReleaseLink = ({ r }: { r: Release }) => (
  <a href={r.url} download={r.file} className={btn}>
    <span>{r.label}</span>
    <span className="text-xs font-normal opacity-70">{meta(r)}</span>
  </a>
);
const filesFor = (d: Device) => releasesFor(d === "mac" ? "mac" : d);

/** The offline Academia app: its install options exactly as before. */
export function AcademiaDownloadPanel() {
  const [mode, setMode] = useState<Mode>("copy");
  const [pick, setPick] = useState<Device | null>(null);
  const shown = DEVICES.filter((d) => mode === "copy" || d.download.length > 0);
  const chosen = shown.find((d) => d.id === pick) ?? null;
  useEffect(() => {
    // Pre-select this device so phones see their own steps first.
    const t = installTargetFor(navigator.userAgent, navigator.maxTouchPoints, navigator.platform);
    setPick(t === "android" ? "android" : t.startsWith("ios") ? "ios" : /mac/i.test(navigator.userAgent) ? "mac" : "windows");
  }, []);
  const tab = (m: Mode, label: string) => (
    <button type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
      className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold transition ${mode === m ? "bg-amber-400 text-slate-900" : "text-white/70 hover:text-white"}`}>{label}</button>
  );
  return (
    <section aria-label="Academia app" data-app="academia" className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <img src="/academia-icon-192.png" alt="" width={40} height={40} className="h-10 w-10 rounded-xl" />
          <div className="flex-1">
            <h2 className="text-lg font-bold">Academia</h2>
            <p className="text-sm text-white/60">Works offline once installed. No account needed.</p>
          </div>
        </div>
        <div role="tablist" className="mb-4 flex gap-1 rounded-full border border-white/15 p-1">
          {tab("copy", "Copy to phone")}
          {tab("download", "Download")}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {shown.map((d) => (
            <button key={d.id} type="button" onClick={() => setPick(d.id)} aria-pressed={chosen?.id === d.id}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition ${chosen?.id === d.id ? "border-amber-400 bg-amber-400/10" : "border-white/15 hover:border-white/40"}`}>
              <d.icon className="h-7 w-7" />
              <span className="text-sm font-semibold">{d.label}</span>
            </button>
          ))}
        </div>
        {mode === "download" && pick === "ios" && (
          <p className="mt-4 rounded-xl bg-white/5 p-4 text-sm text-white/80">iPhone and iPad have no download file. Use <button type="button" className="underline" onClick={() => setMode("copy")}>Copy to phone</button> instead.</p>
        )}
        {chosen && (
          <div className="mt-4 rounded-xl bg-white/5 p-4 text-sm">
            <ol className="list-decimal space-y-1 pl-5 text-white/80">
              {(mode === "copy" ? chosen.copy : chosen.download).map((s) => <li key={s}>{s}</li>)}
            </ol>
            {/* The Home Screen app must be added from the Academia page itself, so it opens Academia. */}
            {mode === "copy" && (
              <a href="/academia-app?install=1" className={btn}>{chosen.id === "android" || chosen.id === "ios" ? "Copy to phone" : "Copy to computer"}</a>
            )}
            {mode === "download" && filesFor(chosen.id).map((r) => <ReleaseLink key={r.file} r={r} />)}
          </div>
        )}
    </section>
  );
}

/**
 * The download page: two separate apps side by side. Mathemagine (the main
 * website as an app) on the left, Academia (offline student app) on the right.
 * Phones stack them, Mathemagine first.
 */
export function AppsDownloadPanels() {
  return (
    <div data-testid="two-apps" className="grid gap-4 md:grid-cols-2">
      <MathemagineAppPanel />
      <AcademiaDownloadPanel />
    </div>
  );
}

export default function DownloadAcademiaDialog({ onClose }: { onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Download the apps" className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3 sm:p-4">
      <div className="max-h-[92dvh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/10 bg-[hsl(224_70%_9%)] p-4 text-white shadow-2xl sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex-1">
            <h2 className="text-lg font-bold">Download the apps</h2>
            <p className="text-sm text-white/60">Two apps: Mathemagine for the full platform, Academia for offline learning.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-full p-2 hover:bg-white/10"><X className="h-5 w-5" /></button>
        </div>
        <AppsDownloadPanels />
      </div>
    </div>
  );
}
