/**
 * Teacher control over who comes in.
 *
 * Free entry on: anyone with the invite link is in the session immediately.
 * Free entry off: guests wait here until the teacher admits them.
 */
import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, UserRound, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  decideEntry, fetchEntryRequests, fetchFreeEntry, setFreeEntry, type EntryRequest,
} from "@/lib/live/publicAudience";

const AudienceEntryPanel = ({ sessionId }: { sessionId: string }) => {
  const [free, setFree] = useState<boolean | null>(null);
  const [requests, setRequests] = useState<EntryRequest[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setRequests((await fetchEntryRequests(sessionId)).filter((r) => r.status === "pending"));
  }, [sessionId]);

  useEffect(() => {
    (async () => {
      setFree(await fetchFreeEntry(sessionId));
      await refresh();
    })();
  }, [sessionId, refresh]);

  useEffect(() => {
    if (free) return;
    const t = setInterval(() => { void refresh(); }, 5000);
    return () => clearInterval(t);
  }, [free, refresh]);

  const toggle = async (next: boolean) => {
    setBusy(true);
    setFree(next);
    await setFreeEntry(sessionId, next);
    setBusy(false);
  };

  const decide = async (id: string, status: "approved" | "declined") => {
    await decideEntry(id, status);
    await refresh();
  };

  return (
    <section className="rounded-2xl border border-border bg-card/40 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">Free entry</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            On: anyone with the invite link enters straight away. Off: they wait for your approval.
          </p>
        </div>
        {free === null ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <Switch checked={free} disabled={busy} onCheckedChange={(v) => void toggle(v)} />
        )}
      </div>

      {free === false && (
        <div className="mt-4 space-y-2 border-t border-border pt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Waiting to enter ({requests.length})
          </div>
          {requests.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nobody is waiting.</div>
          ) : (
            requests.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div className="flex min-w-0 items-center gap-2 text-sm">
                  <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{r.display_name ?? "Guest"}</span>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" onClick={() => void decide(r.id, "approved")}>
                    <Check className="mr-1 h-3.5 w-3.5" /> Admit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void decide(r.id, "declined")}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
};

export default AudienceEntryPanel;
