/** Front-page download page: the Mathemagine app (left) and the offline Academia app (right), each opening its own install page. Also Academia's install steps. */
import { Apple, ArrowLeft, Laptop, Monitor, Smartphone, X } from "lucide-react";
import { ACADEMIA_INSTALL_PATH, MATHEMAGINE_INSTALL_PATH } from "@/lib/install/appInstallPages";

type Device = "android" | "ios" | "windows" | "mac";
export type Mode = "copy" | "download";
type Info = { id: Device; label: string; icon: typeof Apple; copy: string[]; download: string[] };

/** Academia install steps (shown on /install/academia). Every device can copy Academia from the browser; iPhone/iPad has no download file. */
export const DEVICES: Info[] = [
  { id: "android", label: "Android", icon: Smartphone,
    copy: ["Tap Copy link below and open the link in Chrome on the Android phone (send it to yourself if you are on another device).", "On the phone, tap Install Academia, or open the Chrome menu and choose Add to Home screen.", "Open Academia from its new icon once with internet. After that it works with no data."],
    download: ["Tap Download APK below.", "Open the downloaded file and tap Install (allow installs from your browser if asked)."] },
  { id: "ios", label: "iPhone / iPad", icon: Apple,
    copy: ["Tap Copy link below and open the link in Safari on the iPhone or iPad.", "In Safari tap Share, then Add to Home Screen, then Add (the taps are shown below on the iPhone).", "Open Academia from its new icon once with internet. After that it works with no data."],
    download: [] },
  { id: "windows", label: "Windows", icon: Monitor,
    copy: ["Click Copy link below and open the link in Chrome or Edge on the computer.", "Click Install Academia, or the Install icon at the right of the address bar.", "Open it once with internet; after that it works with no data."],
    download: ["Click Download for Windows below (Windows 10 or 11, 64-bit).", "Open the downloaded Academia installer (Mathemagine-Setup in this build) and click Next to install. No unzipping and no administrator password needed.", "Open Academia from your desktop or Start menu once with internet (this build's shortcut is still called Mathemagine); after that it works with no data.", "Academia isn't signed yet, so Windows may show a blue screen: click More info, then Run anyway."] },
  { id: "mac", label: "MacBook", icon: Laptop,
    copy: ["Click Copy link below and open the link in Chrome or Edge on the computer.", "Click Install Academia, or the Install icon at the right of the address bar.", "Open it once with internet; after that it works with no data."],
    download: ["Unsigned preview for macOS 11 or newer. Pick Apple chip (M1 or newer) or Intel, then open the downloaded zip.", "Drag the app into Applications (this build's app is still called Mathemagine).", "The first time, right-click the app and choose Open, then Open again.", "Open it once with internet; after that it works with no data."] },
];

const APPS_LISTED = [
  { app: "mathemagine", name: "Mathemagine", href: MATHEMAGINE_INSTALL_PATH, icon: "/mathemagine-icon-192.png",
    text: "The full platform: lesson notes, Smartboard, Games and reports. Needs internet.",
    card: "border-amber-300/40 bg-amber-400/[0.05]" },
  { app: "academia", name: "Academia", href: ACADEMIA_INSTALL_PATH, icon: "/academia-icon-192.png",
    text: "The offline student app. Works with no data once installed. No account needed.",
    card: "border-white/10 bg-white/[0.03]" },
] as const;

/**
 * The download page: two separate apps side by side, Mathemagine (left) and
 * Academia (right); phones stack them, Mathemagine first. Each opens its own
 * install page with a plain link (a full page load), so that page's own
 * manifest and Home Screen icon are the ones Safari and Chrome see, and its
 * Copy link holds one app only.
 */
export function AppsDownloadPanels() {
  return (
    <div data-testid="two-apps" className="grid gap-4 md:grid-cols-2">
      {APPS_LISTED.map((a) => (
        <section key={a.app} aria-label={`${a.name} app`} data-app={a.app} className={`flex min-w-0 flex-col rounded-2xl border p-4 sm:p-5 ${a.card}`}>
          <div className="mb-3 flex items-center gap-3">
            <img src={a.icon} alt="" width={40} height={40} className="h-10 w-10 rounded-xl" />
            <h2 className="flex-1 text-lg font-bold">{a.name}</h2>
          </div>
          <p className="flex-1 text-sm text-white/70">{a.text}</p>
          <p className="mt-3 text-xs text-white/50">Its own page to copy or download it, for Android, iPhone / iPad, Windows and Mac.</p>
          <a href={a.href} className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-amber-400 px-4 font-semibold text-slate-900 hover:bg-amber-300">
            Get {a.name}
          </a>
        </section>
      ))}
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
            <p className="text-sm text-white/60">Two separate apps: Mathemagine for the full platform, Academia for offline learning. Install either one, or both.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-full p-2 hover:bg-white/10"><X className="h-5 w-5" /></button>
        </div>
        <AppsDownloadPanels />
      </div>
    </div>
  );
}

/**
 * The same two apps as a page of its own (`/apps`), so the download is never
 * hidden: it is linked from the signed-in account menu and the front page at
 * every screen size, and works inside either installed app's window.
 */
export function AppsPage() {
  return (
    <main data-apps-page className="min-h-[100dvh] bg-[hsl(224_70%_9%)] px-3 py-6 text-white sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-4xl">
        <a href="/" className="mb-4 inline-flex items-center gap-1 text-sm text-white/60 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Home
        </a>
        <h1 className="text-xl font-bold sm:text-2xl">Download the apps</h1>
        <p className="mb-5 mt-1 text-sm text-white/60">Two separate apps. Install either one, or both, on the same phone, tablet or computer.</p>
        <AppsDownloadPanels />
      </div>
    </main>
  );
}
