import { useState } from "react";
import { Check, Copy, ExternalLink, Lock, Radio } from "lucide-react";
import { BroadcastEntry, displayName, fieldLabel, toHref } from "@/lib/live/broadcast";

type Props = {
  entries: BroadcastEntry[];
  /** When false, details are hidden until the class starts. */
  unlocked: boolean;
};

/** Read-only "How to join this class" card shown to participants. */
const BroadcastPanel = ({ entries, unlocked }: Props) => {
  const [copied, setCopied] = useState<string | null>(null);

  if (entries.length === 0) return null;

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard unavailable — nothing to do */
    }
  };

  if (!unlocked) {
    return (
      <section className="rounded-2xl border border-border bg-card/40 p-5 backdrop-blur">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Lock className="h-4 w-4 text-muted-foreground" /> How to join this class
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Broadcast details appear when the class starts.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card/40 p-5 backdrop-blur">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Radio className="h-4 w-4 text-primary" /> How to join this class
      </div>

      <div className="mt-4 space-y-3">
        {entries.map((entry) => {
          const href = toHref(entry.link);
          const rows = ([
            ["code", entry.code, fieldLabel(entry.platform, "code")],
            ["password", entry.password, fieldLabel(entry.platform, "password")],
          ] as const).filter(([, v]) => !!v);

          return (
            <div key={entry.id} className="rounded-xl border border-border bg-background/60 p-4">
              <div className="text-sm font-semibold">{displayName(entry)}</div>

              {entry.link && (
                <div className="mt-2 flex items-center gap-2">
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{entry.link}</span>
                    </a>
                  ) : (
                    <code className="min-w-0 flex-1 truncate rounded-md border border-border px-2 py-1.5 text-xs">
                      {entry.link}
                    </code>
                  )}
                  <button
                    type="button"
                    onClick={() => copy(`${entry.id}-link`, entry.link!)}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border hover:bg-accent"
                    aria-label="Copy link"
                  >
                    {copied === `${entry.id}-link` ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              )}

              {rows.map(([key, value, label]) => (
                <div key={key} className="mt-2 flex items-center gap-2">
                  <span className="w-32 shrink-0 text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
                  <code className="min-w-0 flex-1 truncate rounded-md border border-border px-2 py-1.5 text-xs">{value}</code>
                  <button
                    type="button"
                    onClick={() => copy(`${entry.id}-${key}`, value!)}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border hover:bg-accent"
                    aria-label={`Copy ${label}`}
                  >
                    {copied === `${entry.id}-${key}` ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              ))}

              {entry.note && <p className="mt-2 text-xs text-muted-foreground">{entry.note}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default BroadcastPanel;
