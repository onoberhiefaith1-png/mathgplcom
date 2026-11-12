/**
 * One app's own install page (`/install/academia`, `/install/mathemagine`).
 * Same flow for both apps: Copy link (this page's own address) or Download,
 * a device picker, steps, the browser's Install button, and the iPhone Safari
 * taps. The page's <head> (routes/install/*) carries only this app's manifest
 * and Home Screen icon, so whatever is installed from here is this app.
 */
import { useEffect, useState } from "react";
import { Apple, ArrowLeft, Check, Copy, Download, Laptop, Monitor, Plane, Share, Smartphone, SquarePlus } from "lucide-react";
import { installTargetFor, type InstallTarget } from "@/lib/offline/installTarget";
import { releasesFor, sizeLabel, type Release } from "@/lib/offline/releases";
import { APPS_PAGE_PATH, browserFor, currentAppWindow, installPageLink, manualInstallSteps, useAppInstallPrompt, type InstallApp } from "@/lib/install/appInstallPages";
import { MATHEMAGINE_COPY_STEPS, MATHEMAGINE_DOWNLOAD_STEPS } from "@/lib/install/mathemagineApp";
import { DEVICES as ACADEMIA_DEVICES } from "@/components/site/DownloadAcademiaDialog";

export type Device = "android" | "ios" | "windows" | "mac";
export type Mode = "copy" | "download";

type AppInfo = {
  name: string;
  icon: string;
  tagline: string;
  steps: Record<Mode, Record<Device, string[]>>;
  files: (d: Device) => Release[];
  offline: boolean;
};

const byDevice = (pick: "copy" | "download") =>
  Object.fromEntries(ACADEMIA_DEVICES.map((d) => [d.id, d[pick]])) as Record<Device, string[]>;

export const APPS: Record<InstallApp, AppInfo> = {
  academia: {
    name: "Academia",
    icon: "/academia-icon-192.png",
    tagline: "The offline student app. Works with no data once installed. No account needed.",
    steps: { copy: byDevice("copy"), download: byDevice("download") },
    files: (d) => releasesFor(d === "mac" ? "mac" : d),
    offline: true,
  },
  mathemagine: {
    name: "Mathemagine",
    icon: "/mathemagine-icon-192.png",
    tagline: "The full platform: lesson notes, Smartboard, Games and reports. Needs internet.",
    steps: { copy: MATHEMAGINE_COPY_STEPS, download: MATHEMAGINE_DOWNLOAD_STEPS },
    // No Mathemagine installer file is built yet (public/desktop/mathemagine-latest.json).
    files: () => [],
    offline: false,
  },
};

const DEVICE_TILES: { id: Device; label: string; icon: typeof Apple }[] = [
  { id: "android", label: "Android", icon: Smartphone },
  { id: "ios", label: "iPhone / iPad", icon: Apple },
  { id: "windows", label: "Windows", icon: Monitor },
  { id: "mac", label: "MacBook", icon: Laptop },
];

export const deviceFor = (t: InstallTarget, ua: string): Device =>
  t === "android" ? "android" : t.startsWith("ios") ? "ios" : /mac/i.test(ua) ? "mac" : "windows";

const btn = "mt-4 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-amber-400 px-4 py-1 font-semibold text-slate-900 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60";

export default function AppInstallPage({ app }: { app: InstallApp }) {
  const info = APPS[app];
  const [mode, setMode] = useState<Mode>("copy");
  const [pick, setPick] = useState<Device>("windows");
  const [target, setTarget] = useState<InstallTarget>("desktop");
  const [link, setLink] = useState(() => installPageLink(app, { origin: "https://mathgpl.com", pathname: "" }));
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [insideApp, setInsideApp] = useState<InstallApp | "unknown" | null>(null);
  const [ua, setUa] = useState("");
  const install = useAppInstallPrompt();

  useEffect(() => {
    const t = installTargetFor(navigator.userAgent, navigator.maxTouchPoints, navigator.platform);
    setTarget(t);
    setPick(deviceFor(t, navigator.userAgent));
    setLink(installPageLink(app));
    setUa(navigator.userAgent);
    // Inside the other app's window: stay here so this app can still be installed.
    const w = currentAppWindow();
    setInsideApp(w && w !== app ? w : null);
  }, [app]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied("yes");
    } catch {
      setCopied("failed");
    }
  };
  const runInstall = async () => {
    // No install offer from the browser (already installed, dismissed, another
    // app's window, or a browser without one): show how to do it by hand.
    if (!install.ready) { setHelp(true); setNote(null); return; }
    const r = await install.prompt();
    setNote(r === "accepted" ? `Installing ${info.name}…` : r === "dismissed" ? "Install cancelled. You can try again any time." : null);
    if (r === "unavailable") setHelp(true);
  };
  const helpSteps = manualInstallSteps({
    name: info.name,
    browser: browserFor(ua),
    mobile: target !== "desktop",
    ios: target.startsWith("ios"),
    insideApp,
  });

  const tiles = DEVICE_TILES.filter((d) => mode === "copy" || info.steps.download[d.id].length > 0);
  const chosen = tiles.find((d) => d.id === pick) ?? null;
  const files = chosen ? info.files(chosen.id) : [];
  const onThisIphone = pick === "ios" && target.startsWith("ios");
  const installButton = (
    <>
      {/* Never hidden or greyed out: with no browser offer it explains the steps. */}
      <button type="button" data-testid="install-app" onClick={() => void runInstall()} className={btn}>
        <Download className="h-5 w-5" /> Install {info.name}
      </button>
      {help && (
        <ol data-testid="install-help" className="mt-3 list-decimal space-y-1 rounded-lg bg-black/30 p-3 pl-7 text-xs text-white/80 sm:text-sm">
          {helpSteps.map((s) => <li key={s}>{s}</li>)}
        </ol>
      )}
      {note && <p className="mt-2 text-xs text-white/70" role="status">{note}</p>}
    </>
  );
  const tab = (m: Mode, label: string) => (
    <button type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
      className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold transition ${mode === m ? "bg-amber-400 text-slate-900" : "text-white/70 hover:text-white"}`}>{label}</button>
  );

  return (
    <main data-install-app={app} className="min-h-[100dvh] bg-[hsl(224_70%_9%)] px-3 py-6 text-white sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-xl">
        <a href={APPS_PAGE_PATH} className="mb-4 inline-flex items-center gap-1 text-sm text-white/60 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Both apps
        </a>
        <section aria-label={`${info.name} app`} data-app={app} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <img src={info.icon} alt="" width={48} height={48} className="h-12 w-12 rounded-xl" />
            <div className="flex-1">
              <h1 className="text-xl font-bold">Install {info.name}</h1>
              <p className="text-sm text-white/60">{info.tagline}</p>
            </div>
          </div>
          {insideApp && (
            <p data-testid="inside-other-app" className="mb-4 rounded-xl border border-amber-300/40 bg-amber-400/10 p-3 text-sm text-amber-100">
              You are inside the {insideApp === "unknown" ? "installed" : insideApp === "academia" ? "Academia" : "Mathemagine"} app. {info.name} is a separate app: copy the link below and open it in {target.startsWith("ios") ? "Safari" : "Chrome or Edge"} to install it.
            </p>
          )}
          <div role="tablist" className="mb-4 flex gap-1 rounded-full border border-white/15 p-1">
            {tab("copy", "Copy link")}
            {tab("download", "Download")}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tiles.map((d) => (
              <button key={d.id} type="button" aria-pressed={chosen?.id === d.id} onClick={() => setPick(d.id)}
                className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition sm:p-4 ${chosen?.id === d.id ? "border-amber-400 bg-amber-400/10" : "border-white/15 hover:border-white/40"}`}>
                <d.icon className="h-7 w-7" />
                <span className="text-center text-sm font-semibold">{d.label}</span>
              </button>
            ))}
          </div>

          {mode === "download" && pick === "ios" && (
            <p className="mt-4 rounded-xl bg-white/5 p-4 text-sm text-white/80">
              iPhone and iPad have no download file. Use <button type="button" className="underline" onClick={() => setMode("copy")}>Copy link</button> instead.
            </p>
          )}

          {chosen && (
            <div className="mt-4 rounded-xl bg-white/5 p-4 text-sm">
              <ol className="list-decimal space-y-1 pl-5 text-white/80">
                {info.steps[mode][chosen.id].map((s) => <li key={s}>{s}</li>)}
              </ol>

              {mode === "copy" && (
                <>
                  <p data-testid="install-link" className="mt-4 break-all rounded-lg bg-black/30 p-3 font-mono text-xs text-white/80 sm:text-sm">{link}</p>
                  <button type="button" data-testid="copy-link" onClick={() => void copy()} className={btn}>
                    {copied === "yes" ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                    {copied === "yes" ? "Link copied" : "Copy link"}
                  </button>
                  {copied === "yes" && <p className="mt-2 text-xs text-white/70" role="status">Paste it into {chosen.id === "ios" ? "Safari" : "Chrome or Edge"} on the device. It opens this {info.name} page only.</p>}
                  {copied === "failed" && <p className="mt-2 text-xs text-amber-200" role="status">Could not copy. Press and hold the link above to copy it.</p>}
                  {chosen.id === "ios" ? (
                    onThisIphone && (target === "ios-other-browser" ? (
                      <p className="mt-4 text-amber-200">Open this link in Safari first. Other iPhone browsers cannot add apps to the Home Screen.</p>
                    ) : (
                      insideApp ? (
                        <ol data-testid="install-help" className="mt-4 list-decimal space-y-1 rounded-lg bg-black/30 p-3 pl-7 text-sm text-white/80">
                          {helpSteps.map((s) => <li key={s}>{s}</li>)}
                        </ol>
                      ) : <SafariSteps name={info.name} icon={info.icon} offline={info.offline} />
                    ))
                  ) : installButton}
                </>
              )}

              {mode === "download" && (
                files.length > 0 ? files.map((r) => (
                  <a key={r.file} href={r.url} download={r.file} className={`${btn} flex-col gap-0`}>
                    <span>{r.label}</span>
                    <span className="text-xs font-normal opacity-70">{`Version ${r.version} · ${sizeLabel(r.bytes)} · built ${r.builtAt}`}</span>
                  </a>
                )) : installButton
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

/** The three Safari taps, for the app this page installs. */
export function SafariSteps({ name, icon, offline }: { name: string; icon: string; offline: boolean }) {
  return (
    <ol data-testid="safari-steps" className="mt-4 space-y-3">
      <Step n={1} icon={<Share className="h-6 w-6 text-amber-300" />}>
        Tap the <b>Share</b> button at the bottom of Safari (a square with an arrow).
      </Step>
      <Step n={2} icon={<SquarePlus className="h-6 w-6 text-amber-300" />}>
        Scroll down and tap <b>Add to Home Screen</b>. The name should say <b>{name}</b>.
      </Step>
      <Step n={3} icon={<img src={icon} alt="" className="h-6 w-6 rounded-md" />}>
        Tap <b>Add</b>. {name} is now on your Home Screen.
      </Step>
      {offline && (
        <Step n={4} icon={<Plane className="h-6 w-6 text-amber-300" />}>
          Open {name} from its icon <b>once with internet</b>. After that it works in airplane mode.
        </Step>
      )}
    </ol>
  );
}

function Step({ n, icon, children }: { n: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 rounded-xl bg-white/5 p-3">
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400 text-sm font-bold text-slate-900">{n}</span>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="text-sm leading-snug">{children}</span>
    </li>
  );
}
