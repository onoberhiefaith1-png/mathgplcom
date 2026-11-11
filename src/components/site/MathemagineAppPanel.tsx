/** Install options for the Mathemagine app (the main website from its own icon). */
import { useEffect, useState } from "react";
import { Apple, Check, Download, Laptop, Monitor, Smartphone } from "lucide-react";
import { installTargetFor, type InstallTarget } from "@/lib/offline/installTarget";
import {
  MATHEMAGINE_STEPS,
  listenForMathemagineInstall,
  promptMathemagineInstall,
  useMathemagineInstallPrompt,
  type MathemagineDevice,
} from "@/lib/install/mathemagineApp";

export const MATHEMAGINE_DEVICES: { id: MathemagineDevice; label: string; icon: typeof Apple }[] = [
  { id: "android", label: "Android", icon: Smartphone },
  { id: "ios", label: "iPhone / iPad", icon: Apple },
  { id: "windows", label: "Windows", icon: Monitor },
  { id: "mac", label: "MacBook", icon: Laptop },
];

export const deviceForTarget = (t: InstallTarget, ua: string): MathemagineDevice =>
  t === "android" ? "android" : t.startsWith("ios") ? "ios" : /mac/i.test(ua) ? "mac" : "windows";

const standalone = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(display-mode: standalone)").matches &&
  !window.location.pathname.startsWith("/academia-app");

export default function MathemagineAppPanel() {
  const [pick, setPick] = useState<MathemagineDevice>("windows");
  const [iosOther, setIosOther] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const canPrompt = useMathemagineInstallPrompt();
  useEffect(() => {
    const t = installTargetFor(navigator.userAgent, navigator.maxTouchPoints, navigator.platform);
    setPick(deviceForTarget(t, navigator.userAgent));
    setIosOther(t === "ios-other-browser");
    setInstalled(standalone());
    return listenForMathemagineInstall();
  }, []);
  const install = async () => {
    const r = await promptMathemagineInstall();
    setNote(r === "accepted" ? "Installing Mathemagine…" : r === "dismissed" ? "Install cancelled. You can try again any time." : null);
  };
  return (
    <section aria-label="Mathemagine app" data-app="mathemagine" className="min-w-0 rounded-2xl border border-amber-300/40 bg-amber-400/[0.05] p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-3">
        <img src="/mathemagine-icon-192.png" alt="" width={40} height={40} className="h-10 w-10 rounded-xl" />
        <div className="flex-1">
          <h2 className="text-lg font-bold">Mathemagine</h2>
          <p className="text-sm text-white/60">The full platform: lesson notes, Smartboard, Games and reports. Needs internet.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {MATHEMAGINE_DEVICES.map((d) => (
          <button key={d.id} type="button" aria-pressed={pick === d.id}
            onPointerDown={(e) => { if (e.button === 0) setPick(d.id); }}
            onClick={() => setPick(d.id)}
            className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition ${pick === d.id ? "border-amber-400 bg-amber-400/10" : "border-white/15 hover:border-white/40"}`}>
            <d.icon className="h-7 w-7" />
            <span className="text-sm font-semibold">{d.label}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-xl bg-white/5 p-4 text-sm">
        {installed ? (
          <p className="flex items-center gap-2 text-white/80"><Check className="h-4 w-4" /> Mathemagine is already installed on this device.</p>
        ) : (
          <>
            {pick === "ios" && iosOther && (
              <p className="mb-2 text-amber-200">Open this page in Safari first. Other iPhone browsers cannot add apps to the Home Screen.</p>
            )}
            <ol className="list-decimal space-y-1 pl-5 text-white/80">
              {MATHEMAGINE_STEPS[pick].map((s) => <li key={s}>{s}</li>)}
            </ol>
            {pick !== "ios" && (
              <button type="button" onClick={() => void install()} disabled={!canPrompt}
                className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-amber-400 px-4 font-semibold text-slate-900 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60">
                <Download className="h-5 w-5" /> Install Mathemagine
              </button>
            )}
            {pick !== "ios" && !canPrompt && (
              <p className="mt-2 text-xs text-white/60">If the button stays grey, use the browser menu: Install app, or Add to Home screen.</p>
            )}
            {note && <p className="mt-2 text-xs text-white/70" role="status">{note}</p>}
          </>
        )}
      </div>
    </section>
  );
}
