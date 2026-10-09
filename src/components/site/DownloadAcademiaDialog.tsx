/** Front-page device picker for installing the offline Academia app. */
import { useState } from "react";
import { Apple, Laptop, Monitor, Smartphone, X } from "lucide-react";

type Device = "android" | "ios" | "windows" | "mac";
const DEVICES: { id: Device; label: string; icon: typeof Apple; steps: string[] }[] = [
  { id: "android", label: "Android", icon: Smartphone, steps: ["Open in Chrome.", "Tap Install when it appears (or menu ⋮ → Install app)."] },
  { id: "ios", label: "iPhone / iPad", icon: Apple, steps: ["Open in Safari.", "Tap Share, then Add to Home Screen."] },
  { id: "windows", label: "Windows", icon: Monitor, steps: ["Open in Chrome or Edge.", "Click Install in the top bar."] },
  { id: "mac", label: "MacBook", icon: Laptop, steps: ["Open in Chrome or Edge.", "Click Install in the address bar. (Safari: File → Add to Dock.)"] },
];

export default function DownloadAcademiaDialog({ onClose }: { onClose: () => void }) {
  const [pick, setPick] = useState<Device | null>(null);
  const chosen = DEVICES.find((d) => d.id === pick);
  return (
    <div role="dialog" aria-modal="true" aria-label="Download Academia" className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[hsl(224_70%_9%)] p-6 text-white shadow-2xl">
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
            <a href="/academia-app" className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-amber-400 font-semibold text-slate-900 hover:bg-amber-300">
              Open Academia to install
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
