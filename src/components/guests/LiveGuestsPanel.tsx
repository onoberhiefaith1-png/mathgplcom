// Live guests — the teacher watching a Guest Link, read-only.
//
// The same idea as "View Student Work", but for people who never registered:
// who is on the link right now, which question they are on, and every line the
// marking engine has already awarded them. Nothing here can be edited, and
// nothing touches a registered student's progress.

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Radio, RefreshCw } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { loadGuestWork, loadLiveGuests, type GuestWorkRow, type LiveGuestRow } from "@/lib/guests/guestLinks";

const since = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)} h ago`;
};

const LiveGuestsPanel = ({
  open,
  onOpenChange,
  linkId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  linkId: string;
}) => {
  const [guests, setGuests] = useState<LiveGuestRow[]>([]);
  const [selected, setSelected] = useState<LiveGuestRow | null>(null);
  const [work, setWork] = useState<GuestWorkRow[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      setGuests(await loadLiveGuests(linkId));
      if (selected) setWork(await loadGuestWork(linkId, selected.token));
    } finally {
      setBusy(false);
    }
  }, [linkId, selected]);

  // Live: a short poll keeps the roster and the awarded lines current.
  useEffect(() => {
    if (!open) return;
    void refresh();
    const id = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(id);
  }, [open, refresh]);

  const onlineCount = guests.filter((g) => g.online).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Radio className={`h-4 w-4 ${onlineCount > 0 ? "text-emerald-500" : "text-muted-foreground"}`} />
            Live guests
          </SheetTitle>
        </SheetHeader>

        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{onlineCount} working now · {guests.length} total</span>
          <Button type="button" size="sm" variant="ghost" onClick={() => void refresh()} disabled={busy}>
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {!selected ? (
          guests.length === 0 ? (
            <p className="mt-4 rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
              Nobody has opened this link yet. Guests appear here the moment they start.
            </p>
          ) : (
            <ul className="mt-3 divide-y rounded-lg border text-sm">
              {guests.map((g) => (
                <li key={g.token}>
                  <button
                    type="button"
                    onClick={() => { setSelected(g); setWork([]); }}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/50"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-medium">
                        <span className={`h-2 w-2 rounded-full ${g.online ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                        {g.guestName}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {g.online ? "solving now" : `last seen ${since(g.lastSeenAt)}`}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {g.score}/{g.totalMarks || "—"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className="mt-3 space-y-3">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> All guests
            </button>

            <div className="rounded-lg border p-3 text-sm">
              <div className="font-semibold">{selected.guestName}</div>
              <p className="text-xs text-muted-foreground">
                {selected.online ? "Working right now" : `Last seen ${since(selected.lastSeenAt)}`} · started {since(selected.startedAt)}
              </p>
            </div>

            {work.length === 0 ? (
              <p className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
                No marked lines yet — the engine records each line as it is awarded.
              </p>
            ) : (
              work.map((w) => {
                const lines = Object.entries(w.solvedLines);
                return (
                  <div key={w.assessmentId} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold">
                        {w.status === "completed" ? "Completed" : "In progress"}
                      </span>
                      <span className="tabular-nums text-muted-foreground">{w.score}/{w.totalMarks}</span>
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {lines.map(([key, marks], i) => (
                        <li key={key} className="flex items-center justify-between gap-2">
                          <span>Line {i + 1} awarded</span>
                          <span className="tabular-nums text-emerald-600">+{marks}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default LiveGuestsPanel;
