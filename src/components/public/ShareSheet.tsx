// Share sheet for public links (Smart Cards, MathGPL Live invites).
//
// The native share sheet only exists on mobile browsers; on desktop and inside
// the app preview `navigator.share` is absent, which is why the old Share
// button appeared to do nothing. This dialog is the dependable path: the same
// platforms people actually use, each opened with the public link.

import { useState } from "react";
import { Check, Copy, Link2, Share2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The public URL being shared. */
  url: string;
  /** Message that precedes the link on platforms that accept text. */
  title: string;
};

const targets = (url: string, text: string) => [
  { label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}` },
  { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
  { label: "X", href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}` },
  { label: "Telegram", href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
  { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
];

const ShareSheet = ({ open, onOpenChange, url, title }: Props) => {
  const [copied, setCopied] = useState<"link" | "caption" | null>(null);

  const copy = async (what: "link" | "caption") => {
    const value = what === "link" ? url : `${title} ${url}`;
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch { /* clipboard blocked */ }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Share2 className="h-4 w-4" /> Share
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          {targets(url, title).map((t) => (
            <a
              key={t.label}
              href={t.href}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-[44px] items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-medium transition hover:bg-accent hover:text-accent-foreground"
            >
              {t.label}
            </a>
          ))}
          {/* Instagram has no web share endpoint — the caption is copied instead. */}
          <button
            type="button"
            onClick={() => copy("caption")}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-4 text-sm font-medium transition hover:bg-accent hover:text-accent-foreground"
          >
            {copied === "caption" ? <Check className="h-4 w-4" /> : null}
            Instagram caption
          </button>
        </div>

        <div className="mt-1 flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
          <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{url.replace(/^https?:\/\//, "")}</span>
          <button
            type="button"
            onClick={() => copy("link")}
            className="flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
          >
            {copied === "link" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied === "link" ? "Copied" : "Copy link"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareSheet;
