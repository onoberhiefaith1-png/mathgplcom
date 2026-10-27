// Timer Arena live classroom display — Champions Wheel + Top 5 per question + who is here.
// Read-only: opened with the display code, it carries no settings or records.
// Styled with the Mathemagine tokens (.mm-app) — navy + gold, gold-bordered cards.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { Loader2, Maximize2, Moon, Sun, Trophy, Users, Wifi, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchArenaBoard, type ArenaBoard } from "@/lib/arena/arenaClient";
import { acceptBoard, changedChampions, pollDelayMs, sliceHue } from "@/lib/arena/liveBoard";
import { agoText } from "@/lib/arena/presence";
import { wheelPages } from "@/lib/arena/ranking";
import { ChampionsWheel, StudentStrip, TopFiveCard } from "@/components/arena/ArenaLiveParts";

type Theme = "dark" | "light";
const PALETTES = ["ocean", "sunset", "forest"];

const readPrefs = (): { theme: Theme; palette: string } => {
  try {
    const t = localStorage.getItem("mathemagine.theme");
    const p = localStorage.getItem("mathemagine.palette") ?? "ocean";
    return { theme: t === "light" ? "light" : "dark", palette: PALETTES.includes(p) ? p : "ocean" };
  } catch { return { theme: "dark", palette: "ocean" }; }
};

const Kpi = ({ label, value, tone }: { label: string; value: number; tone?: "good" | "muted" | "gold" }) => (
  <div className="mm-arena-card px-4 py-2 text-center" style={{ minWidth: 92 }}>
    <div
      className="text-3xl font-extrabold tabular-nums leading-none sm:text-4xl"
      style={{ color: tone === "good" ? "hsl(158 70% 52%)" : tone === "gold" ? "hsl(var(--mm-accent))" : undefined }}
    >{value}</div>
    <div className="mt-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
  </div>
);

const ArenaLivePage = () => {
  const { code } = useParams({ from: "/arena/live/$code" });
  const [board, setBoard] = useState<ArenaBoard | null>(null);
  const [missing, setMissing] = useState(false);
  const [realtime, setRealtime] = useState(false);
  const [failures, setFailures] = useState(0);
  const [lastOkAt, setLastOkAt] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [prefs, setPrefs] = useState<{ theme: Theme; palette: string }>({ theme: "dark", palette: "ocean" });
  const prev = useRef<ArenaBoard | null>(null);
  const inflight = useRef(false);
  const again = useRef(false);

  useEffect(() => { setPrefs(readPrefs()); }, []);
  const toggleTheme = () => {
    const theme: Theme = prefs.theme === "dark" ? "light" : "dark";
    setPrefs({ ...prefs, theme });
    try { localStorage.setItem("mathemagine.theme", theme); } catch { /* private mode */ }
  };

  const load = useCallback(async () => {
    // One request at a time; a nudge that arrives mid-flight triggers one more read after it.
    if (inflight.current) { again.current = true; return; }
    inflight.current = true;
    try {
      const incoming = await fetchArenaBoard(code.toUpperCase());
      const next = acceptBoard(prev.current, incoming);
      if (next === incoming) {
        const changed = changedChampions(prev.current, incoming);
        if (changed.size) { setFlash(changed); window.setTimeout(() => setFlash(new Set()), 1700); }
        prev.current = incoming;
        setBoard(incoming);
      }
      setFailures(0);
      setLastOkAt(Date.now());
    } catch (e) {
      const notFound = (e as Error).message === "not_found";
      if (!prev.current && notFound) setMissing(true);
      setFailures((f) => f + 1);
    } finally {
      inflight.current = false;
      if (again.current) { again.current = false; void load(); }
    }
  }, [code]);

  // Poll steadily — this is what keeps the report right even if realtime is blocked on the school network.
  const pollRef = useRef({ realtime, failures });
  pollRef.current = { realtime, failures };
  useEffect(() => {
    let timer: number | undefined;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      void load();
      timer = window.setTimeout(tick, pollDelayMs({ ...pollRef.current, hidden: document.visibilityState === "hidden" }));
    };
    tick();
    const onVisible = () => { if (document.visibilityState === "visible") { window.clearTimeout(timer); tick(); } };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => { stopped = true; window.clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("online", onVisible); };
  }, [load]);

  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, []);

  // Realtime nudges (join / start / new best) re-read immediately.
  const shareId = board?.shareId;
  useEffect(() => {
    if (!shareId) return;
    let timer: number | undefined;
    const channel = supabase
      .channel(`arena:${shareId}`)
      .on("broadcast", { event: "update" }, () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => void load(), 200);
      })
      .subscribe((status) => {
        setRealtime(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") void load();
      });
    return () => { window.clearTimeout(timer); void supabase.removeChannel(channel); };
  }, [shareId, load]);

  const pages = useMemo(() => wheelPages(board?.columns ?? []), [board]);
  const current = pages[Math.min(page, Math.max(0, pages.length - 1))];
  const shell = `mm-app ${prefs.theme === "light" ? "mm-light" : "mm-dark"} mm-palette-${prefs.palette} min-h-screen bg-background text-foreground`;

  if (missing) return <div className={`${shell} grid place-items-center p-6 text-base`}>This display link is not valid.</div>;
  if (!board) return <div className={`${shell} grid place-items-center`}><Loader2 className="h-8 w-8 animate-spin" style={{ color: "hsl(var(--mm-accent))" }} /></div>;

  const crumbs = [board.crumbs["school"], board.crumbs["class"], board.crumbs["subject"], board.crumbs["topic"], board.crumbs["subtopic"]].filter(Boolean);
  const people = board.participants ?? [];
  const active = board.active ?? board.online;
  const inactive = board.inactive ?? Math.max(0, board.joined - board.online);
  const fresh = lastOkAt != null && failures === 0 && now - lastOkAt < 30_000;
  const stale = lastOkAt == null || failures > 0;
  const liveLabel = stale ? "RECONNECTING" : realtime ? "LIVE" : "LIVE · POLLING";
  const timerOff = board.columns.filter((q) => q.timerEnabled === false).length;

  return (
    <main className={`${shell} p-3 sm:p-5 lg:p-6`}>
      <header className="mm-arena-card flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 sm:px-6 sm:py-4">
        <img src="/academia-icon-192.png" alt="" width={56} height={56} className="h-12 w-12 rounded-xl sm:h-14 sm:w-14" />
        <div className="min-w-0 flex-1 basis-64">
          <p className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <span className="mm-title text-sm font-extrabold normal-case tracking-tight sm:text-base">Mathemagine</span>
            <span>Live Report</span>
            {crumbs.length > 0 && <span className="normal-case tracking-normal opacity-80">{crumbs.join(" · ")}</span>}
          </p>
          <h1 className="mm-title truncate text-2xl font-extrabold tracking-tight sm:text-4xl 2xl:text-5xl">{board.sessionTitle}</h1>
          <p className="text-sm text-muted-foreground">{board.title} · {board.columns.length} question{board.columns.length === 1 ? "" : "s"}{board.status === "closed" ? " · group closed" : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Kpi label="Joined" value={board.joined} />
          <Kpi label="Active" value={active} tone="good" />
          <Kpi label="Inactive" value={inactive} tone="muted" />
          <Kpi label="Ranked" value={board.rankedParticipants} tone="gold" />
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-extrabold tracking-wider"
            style={{ background: stale ? "hsl(38 95% 55% / .2)" : "hsl(158 70% 45% / .2)", color: stale ? "hsl(38 95% 60%)" : "hsl(158 70% 55%)" }}
            role="status"
            aria-live="polite"
          >
            <span className={`h-2.5 w-2.5 rounded-full ${fresh ? "mm-arena-live-dot" : ""}`} style={{ background: stale ? "hsl(38 95% 55%)" : "hsl(158 70% 50%)" }} />
            {stale ? <WifiOff className="h-3.5 w-3.5" aria-hidden /> : <Wifi className="h-3.5 w-3.5" aria-hidden />} {liveLabel}
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">Updated {agoText(lastOkAt, now)}</span>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={toggleTheme} aria-label={prefs.theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} className="mm-theme-btn grid h-10 w-10 place-items-center rounded-full">
            {prefs.theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button type="button" aria-label="Full screen" onClick={() => void document.documentElement.requestFullscreen?.()} className="grid h-10 w-10 place-items-center rounded-full border border-border hover:border-primary">
            <Maximize2 className="h-5 w-5" />
          </button>
        </div>
      </header>

      {board.columns.length === 0 ? (
        <p className="mt-10 text-center text-base text-muted-foreground">This session has no question cards yet.</p>
      ) : (
        <>
          {timerOff > 0 && (
            <p className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm">
              {timerOff} question{timerOff === 1 ? " has its" : "s have their"} timer switched off, so students can't be timed on {timerOff === 1 ? "it" : "them"}. Turn the timer on in the question card's settings.
            </p>
          )}
          <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.5fr)]">
            <div className="mm-arena-card flex flex-col items-center justify-center p-4 sm:p-6">
              {current && <ChampionsWheel cols={current.items} startIndex={current.start} flash={flash} />}
              {pages.length > 1 && (
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {pages.map((p, i) => (
                    <button key={p.label} type="button" onClick={() => setPage(i)} aria-pressed={i === page}
                      className={`rounded-full px-4 py-1.5 text-sm font-bold ${i === page ? "mm-accent-btn" : "border border-border"}`}>{p.label}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid content-start gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {(current?.items ?? []).map((q, i) => (
                <TopFiveCard key={q.assessmentId} q={q} hue={sliceHue((current?.start ?? 0) + i)} flash={flash.has(q.assessmentId)} />
              ))}
            </div>
          </section>

          <section className="mm-arena-card mt-4 p-4 sm:p-5" aria-label="Students">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h2 className="flex items-center gap-2 text-lg font-extrabold"><Users className="h-5 w-5" aria-hidden /> Students</h2>
              <div role="tablist" aria-label="Filter students" className="flex gap-1.5">
                {([["all", `All ${board.joined}`], ["active", `Active ${active}`], ["inactive", `Inactive ${inactive}`]] as const).map(([k, label]) => (
                  <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
                    className={`rounded-full px-3 py-1 text-xs font-bold ${filter === k ? "mm-accent-btn" : "border border-border"}`}>{label}</button>
                ))}
              </div>
              <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Trophy className="h-3.5 w-3.5" aria-hidden /> Fastest correct time wins · a student is active if seen in the last {Math.round((board.activeWindowMs ?? 45000) / 1000)}s</span>
            </div>
            <StudentStrip people={people} total={board.participantsTotal ?? board.joined} nowMs={now} filter={filter} />
            {(board.participantsTotal ?? people.length) > people.length && (
              <p className="mt-2 text-center text-xs text-muted-foreground">Showing {people.length} of {board.participantsTotal} students (most recently active first).</p>
            )}
          </section>
        </>
      )}
    </main>
  );
};

export default ArenaLivePage;
