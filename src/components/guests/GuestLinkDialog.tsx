// Guest Link — the teacher's share panel for ONE Course or Assignment Card.
//
// The link opens the ORIGINAL resource for anyone: no sign-in, no registration,
// no class joining. Guests are marked instantly and their performance is kept
// under Guest Performance, entirely apart from registered students.

import { useEffect, useState } from "react";
import { Check, Copy, Link2, Loader2, Radio, Users } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  ensureGuestLink, guestLinkUrl, loadGuestPerformance, updateGuestLink,
  type GuestLink, type GuestLinkKind, type GuestPerformanceRow,
} from "@/lib/guests/guestLinks";
import LiveGuestsPanel from "./LiveGuestsPanel";

const GuestLinkDialog = ({
  open,
  onOpenChange,
  kind,
  resourceId,
  classId = null,
  title,
  onReady,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: GuestLinkKind;
  resourceId: string;
  classId?: string | null;
  title?: string | null;
  /** Chance to prepare the guest containers (course exercises) once. */
  onReady?: () => Promise<void> | void;
}) => {
  const [link, setLink] = useState<GuestLink | null>(null);
  const [rows, setRows] = useState<GuestPerformanceRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveOpen, setLiveOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setBusy(true);
    setError(null);
    (async () => {
      try {
        const created = await ensureGuestLink({ kind, resourceId, classId, title });
        if (!alive) return;
        setLink(created);
        await onReady?.();
        const perf = await loadGuestPerformance(created.id);
        if (alive) setRows(perf);
      } catch (e) {
        if (alive) setError(friendlyError(e));
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind, resourceId, classId, reloadKey]);

  const url = link ? guestLinkUrl(link) : "";

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const setFlag = async (patch: Partial<Pick<GuestLink, "enabled" | "ask_name">>) => {
    if (!link) return;
    setLink({ ...link, ...patch });
    await updateGuestLink(link.id, patch);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" /> Guest Link
          </DialogTitle>
          <DialogDescription>
            Anyone with this link opens {kind === "course" ? "this course" : "this assignment card"}
            {" "}directly — no sign-in, no class. Their work is marked instantly and kept separate
            from your students.
          </DialogDescription>
        </DialogHeader>

        {busy ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Preparing the link…
          </div>
        ) : error ? (
          <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="min-h-[40px] w-full rounded-lg border border-input bg-muted/30 px-3 text-sm"
              />
              <Button type="button" size="sm" onClick={copy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="text-sm">
                <div className="font-medium">Link active</div>
                <p className="text-xs text-muted-foreground">Turn off to close guest access instantly.</p>
              </div>
              <Switch checked={!!link?.enabled} onCheckedChange={(v) => void setFlag({ enabled: v })} />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="text-sm">
                <div className="font-medium">Ask for a name</div>
                <p className="text-xs text-muted-foreground">Guests can always skip it.</p>
              </div>
              <Switch checked={!!link?.ask_name} onCheckedChange={(v) => void setFlag({ ask_name: v })} />
            </div>

            {link && (
              <Button type="button" variant="secondary" className="w-full" onClick={() => setLiveOpen(true)}>
                <Radio className="mr-2 h-4 w-4" /> Live guests
              </Button>
            )}

            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4" /> Guest Performance
              </div>
              {rows.length === 0 ? (
                <p className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
                  No guests yet. Nothing here affects your class results.
                </p>
              ) : (
                <ul className="divide-y rounded-lg border text-sm">
                  {rows.map((r) => (
                    <li key={`${r.guestName}-${r.updatedAt}`} className="flex items-center justify-between px-3 py-2">
                      <span>{r.guestName}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {r.score}/{r.totalMarks} {r.status === "completed" ? "• done" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
      {link && <LiveGuestsPanel open={liveOpen} onOpenChange={setLiveOpen} linkId={link.id} />}
    </Dialog>
  );
};

export default GuestLinkDialog;
