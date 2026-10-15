// Student "Your Results" — own best, group's overall best and own position.
// Only ever computed inside the student's own Arena group.
import { useCallback, useEffect, useState } from "react";
import { Crown, Trophy, X } from "lucide-react";
import { activeArena, fetchArenaMe, type ArenaMe } from "@/lib/arena/arenaClient";
import { formatArenaMs, ordinal } from "@/lib/arena/ranking";

const ArenaMyPanel = ({ guestCode, token, assessmentId }: { guestCode: string; token: string; assessmentId: string }) => {
  const [arena, setArena] = useState<string | null>(null);
  const [me, setMe] = useState<ArenaMe | null>(null);
  const [open, setOpen] = useState(false);
  const [fresh, setFresh] = useState(false);

  useEffect(() => { setArena(activeArena(guestCode)); }, [guestCode]);

  const load = useCallback(async () => {
    if (!arena) return;
    try { setMe(await fetchArenaMe(arena, token, assessmentId)); } catch { /* offline: keep last */ }
  }, [arena, token, assessmentId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail as { assessmentId?: string; newBest?: boolean };
      if (d?.assessmentId !== assessmentId) return;
      setFresh(!!d.newBest);
      setOpen(true);
      void load();
    };
    window.addEventListener("arena:result", on);
    return () => window.removeEventListener("arena:result", on);
  }, [assessmentId, load]);

  if (!arena) return null;
  const p = me?.position;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute bottom-3 left-3 z-40 inline-flex items-center gap-1.5 rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs font-semibold shadow"
      >
        <Trophy className="h-3.5 w-3.5" aria-hidden />
        {p?.ranked ? `${ordinal(p.place)} of ${p.rankedCount}` : "Arena"}
      </button>
    );
  }

  return (
    <div className="absolute bottom-3 left-3 z-40 w-72 rounded-2xl border border-border bg-card/95 p-3 text-sm shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold">Your Results</span>
        <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
      </div>
      {fresh && <div className="mb-2 rounded-full bg-primary px-2 py-0.5 text-center text-xs font-semibold text-primary-foreground">New Best Time!</div>}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border p-2">
          <div className="text-[11px] text-muted-foreground">Your Best Time</div>
          <div className="text-lg font-bold tabular-nums">{formatArenaMs(me?.myBestMs)}</div>
        </div>
        <div className="rounded-xl border border-border p-2">
          <div className="text-[11px] text-muted-foreground">Overall Best Time</div>
          <div className="text-lg font-bold tabular-nums">{formatArenaMs(me?.overallBestMs)}</div>
        </div>
      </div>
      <div className="mt-2 rounded-xl border border-border p-2 text-xs">
        {!p || !p.ranked ? (
          <span>Complete this question correctly to enter the ranking.</span>
        ) : (
          <>
            <div className="text-base font-bold">
              {p.champion && <Crown className="mr-1 inline h-4 w-4" aria-hidden />}
              {ordinal(p.place)} of {p.rankedCount} ranked students
            </div>
            <div className="text-muted-foreground">{me?.joined ?? 0} joined this group</div>
            {p.champion ? (
              <div className="mt-1 font-semibold">You're the Question Champion!</div>
            ) : (
              <>
                {p.behindNextMs != null && <div className="mt-1">You are {(p.behindNextMs / 1000).toFixed(1)}s behind {ordinal(p.place - 1)} place.</div>}
                {p.toTopFiveMs != null ? (
                  <div>Improve by {(p.toTopFiveMs / 1000).toFixed(1)}s to beat 5th place.</div>
                ) : p.inTopFive ? <div className="font-semibold">You're in the Top 5!</div> : null}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ArenaMyPanel;
