/** Step-by-step picture guide for adding Academia to an iPhone/iPad Home Screen. */
import { useState } from "react";
import { Check, Copy, Plane, Share, SquarePlus, X } from "lucide-react";

export default function IosInstallGuide({ inSafari, onClose }: { inSafari: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window === "undefined" ? "https://mathgpl.com/academia-app" : `${window.location.origin}/academia-app`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); } catch { /* user can long-press the link */ }
  };
  return (
    <div role="dialog" aria-modal="true" aria-label="Add Academia to your Home Screen"
      className="fixed inset-0 z-[10000] flex items-end justify-center bg-background/80 p-3 backdrop-blur sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <img src="/academia-icon-192.png" alt="" width={44} height={44} className="h-11 w-11 rounded-xl" />
          <div className="flex-1">
            <h2 className="text-lg font-bold">Put Academia on your iPhone</h2>
            <p className="text-sm text-muted-foreground">Free. Opens like any app, even with no data.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-full p-2 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        {!inSafari ? (
          <div className="space-y-3">
            <p className="text-sm">Only <b>Safari</b> can add apps to an iPhone. Open this link in Safari, then tap Install again:</p>
            <p className="break-all rounded-lg bg-muted p-3 font-mono text-sm">{link}</p>
            <button type="button" onClick={copy} className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-primary font-semibold text-primary-foreground">
              {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />} {copied ? "Link copied. Paste it in Safari" : "Copy link"}
            </button>
          </div>
        ) : (
          <ol className="space-y-3">
            <Step n={1} icon={<Share className="h-6 w-6 text-primary" />}>
              Tap the <b>Share</b> button at the bottom of Safari (a square with an arrow).
            </Step>
            <Step n={2} icon={<SquarePlus className="h-6 w-6 text-primary" />}>
              Scroll down and tap <b>Add to Home Screen</b>.
            </Step>
            <Step n={3} icon={<img src="/academia-icon-192.png" alt="" className="h-6 w-6 rounded-md" />}>
              Tap <b>Add</b>. Academia is now on your Home Screen.
            </Step>
            <Step n={4} icon={<Plane className="h-6 w-6 text-primary" />}>
              Open Academia from its icon <b>once with internet</b> and add your schools. After that it works in airplane mode.
            </Step>
          </ol>
        )}
        <button type="button" onClick={onClose} className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-border font-semibold">Done</button>
      </div>
    </div>
  );
}

function Step({ n, icon, children }: { n: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 rounded-xl bg-muted/60 p-3">
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{n}</span>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="text-sm leading-snug">{children}</span>
    </li>
  );
}
