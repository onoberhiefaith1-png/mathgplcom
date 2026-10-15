// Timer Arena live classroom display — Champions Wheel + Top 5 per question.
// Read-only: opened with the display code, it carries no settings or records.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { Clock, Loader2, Maximize2, Trophy, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchArenaBoard, type ArenaBoard, type ArenaColumn } from "@/lib/arena/arenaClient";
import { avatarEmoji, formatArenaMs, sectorAngle, wheelPages } from "@/lib/arena/ranking";

const SECTORS = ["--arena-s1", "--arena-s2", "--arena-s3", "--arena-s4", "--arena-s5", "--arena-s6", "--arena-s7", "--arena-s8"];
const PLACE = ["--arena-gold", "--arena-silver", "--arena-bronze"];
const c = (v: string, a = 1) => `hsl(var(${v}) / ${a})`;

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as const;
};

const Wheel = ({ cols, flash }: { cols: ArenaColumn[]; flash: Set<string> }) => {
  const n = cols.length;
  const angle = sectorAngle(n);
  const R = 200, cx = 210, cy = 210;
  return (
    <svg viewBox="0 0 420 420" className="h-full max-h-[46vh] w-full" role="img" aria-label="Champions Wheel">
      <circle cx={cx} cy={cy} r={R + 8} fill="none" stroke={c("--arena-gold")} strokeWidth={6} />
      {cols.map((q, i) => {
        const a0 = i * angle, a1 = a0 + angle;
        const [x0, y0] = polar(cx, cy, R, a0);
        const [x1, y1] = polar(cx, cy, R, a1);
        const large = angle > 180 ? 1 : 0;
        const d = n === 1 ? `M ${cx - R} ${cy} a ${R} ${R} 0 1 0 ${R * 2} 0 a ${R} ${R} 0 1 0 ${-R * 2} 0` : `M ${cx} ${cy} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`;
        const [tx, ty] = polar(cx, cy, R * 0.66, a0 + angle / 2);
        const champ = q.top[0];
        return (
          <g key={q.assessmentId} className={flash.has(q.assessmentId) ? "arena-record" : undefined}>
            <path d={d} fill={c(SECTORS[i % SECTORS.length]!, 0.85)} stroke={c("--arena-gold", 0.7)} strokeWidth={2} />
            <text x={tx} y={ty - 38} textAnchor="middle" fontSize={16} fontWeight={800} fill={c("--arena-ink")}>Q{q.number}</text>
            <text x={tx} y={ty + 2} textAnchor="middle" fontSize={30}>{champ ? avatarEmoji(champ.avatar) : "👤"}</text>
            <text x={tx} y={ty + 26} textAnchor="middle" fontSize={champ ? 17 : 11} fontWeight={800} fill={c("--arena-ink")}>
              {champ ? formatArenaMs(champ.ms) : "No champion yet"}
            </text>
            {champ && <text x={tx} y={ty + 42} textAnchor="middle" fontSize={12} fill={c("--arena-ink")}>{champ.name.slice(0, 14)}</text>}
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={62} fill={c("--arena-bg")} stroke={c("--arena-gold")} strokeWidth={4} />
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize={30}>🏆</text>
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize={14} fontWeight={800} fill={c("--arena-gold")}>TIMER ARENA</text>
      <text x={cx} y={cy + 32} textAnchor="middle" fontSize={8} fill={c("--arena-muted")}>QUESTION CHAMPIONS</text>
    </svg>
  );
};

const Column = ({ q, i, flash }: { q: ArenaColumn; i: number; flash: boolean }) => (
  <div className={`min-w-[150px] flex-1 overflow-hidden rounded-xl border ${flash ? "arena-record" : ""}`} style={{ borderColor: c(SECTORS[i % SECTORS.length]!) }}>
    <div className="px-3 py-2 text-center text-sm font-bold" style={{ background: c(SECTORS[i % SECTORS.length]!, 0.9), color: c("--arena-ink") }}>Top 5 – Q{q.number}</div>
    <ol className="space-y-1 p-2">
      {Array.from({ length: 5 }, (_, k) => {
        const r = q.top[k];
        const accent = PLACE[k];
        return (
          <li key={k} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: c("--arena-panel") }}>
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold" style={{ background: accent ? c(accent) : c("--arena-border"), color: c("--arena-bg") }}>{k + 1}</span>
            {r ? (
              <>
                <span className="text-lg" aria-hidden>{avatarEmoji(r.avatar)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{r.name}</span>
                  <span className="block text-xs tabular-nums" style={{ color: k === 0 ? c("--arena-gold") : c("--arena-muted") }}>{formatArenaMs(r.ms)}</span>
                </span>
              </>
            ) : <span className="text-xs" style={{ color: c("--arena-muted") }}>—</span>}
          </li>
        );
      })}
    </ol>
  </div>
);

const ArenaLivePage = () => {
  const { code } = useParams({ from: "/arena/live/$code" });
  const [board, setBoard] = useState<ArenaBoard | null>(null);
  const [missing, setMissing] = useState(false);
  const [live, setLive] = useState(false);
  const [page, setPage] = useState(0);
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const [clock, setClock] = useState(() => new Date());
  const prev = useRef<ArenaBoard | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await fetchArenaBoard(code.toUpperCase());
      const before = prev.current;
      if (before) {
        const changed = new Set<string>();
        next.columns.forEach((col) => {
          const old = before.columns.find((o) => o.assessmentId === col.assessmentId);
          if (col.top[0] && (old?.top[0]?.ms !== col.top[0].ms || old?.top[0]?.name !== col.top[0].name)) changed.add(col.assessmentId);
        });
        if (changed.size) { setFlash(changed); window.setTimeout(() => setFlash(new Set()), 1700); }
      }
      prev.current = next;
      setBoard(next);
    } catch { if (!prev.current) setMissing(true); }
  }, [code]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const id = window.setInterval(() => setClock(new Date()), 1000); return () => window.clearInterval(id); }, []);
  // Online counts drift slowly; a light refresh keeps them honest.
  useEffect(() => { const id = window.setInterval(() => void load(), 30000); return () => window.clearInterval(id); }, [load]);

  const shareId = board?.shareId;
  useEffect(() => {
    if (!shareId) return;
    let timer: number | undefined;
    const channel = supabase
      .channel(`arena:${shareId}`)
      .on("broadcast", { event: "update" }, () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => void load(), 250);
      })
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
        // Fresh snapshot after every (re)connect so nothing is missed.
        if (status === "SUBSCRIBED") void load();
      });
    return () => { window.clearTimeout(timer); void supabase.removeChannel(channel); };
  }, [shareId, load]);

  const pages = useMemo(() => wheelPages(board?.columns ?? []), [board]);
  const current = pages[Math.min(page, Math.max(0, pages.length - 1))];

  if (missing) return <div className="grid min-h-screen place-items-center p-6 text-sm">This display link is not valid.</div>;
  if (!board) return <div className="grid min-h-screen place-items-center" style={{ background: c("--arena-bg") }}><Loader2 className="h-6 w-6 animate-spin" style={{ color: c("--arena-gold") }} /></div>;

  const crumbs = [board.crumbs["school"], board.crumbs["class"], board.crumbs["subject"], board.crumbs["topic"], board.crumbs["subtopic"]].filter(Boolean);
  const shown = new Set(board.columns.flatMap((q) => q.top.map((t) => t.name))).size;

  return (
    <main className="min-h-screen p-3 sm:p-5" style={{ background: c("--arena-bg"), color: c("--arena-ink") }}>
      <header className="flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3" style={{ borderColor: c("--arena-gold", 0.6) }}>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: c("--arena-muted") }}>MathGPL Academia · {crumbs.join(" · ")}</p>
          <h1 className="truncate text-xl font-bold sm:text-3xl" style={{ color: c("--arena-gold") }}>{board.sessionTitle}</h1>
          <p className="text-xs" style={{ color: c("--arena-muted") }}>{board.title} · {board.columns.length} questions</p>
        </div>
        <div className="flex items-center gap-2 text-sm"><Users className="h-4 w-4" /> {board.joined} joined · {board.online} online</div>
        <div className="flex items-center gap-2 text-sm tabular-nums"><Clock className="h-4 w-4" /> {clock.toLocaleTimeString()}</div>
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold" style={{ background: c(live ? "--arena-live" : "--arena-border", 0.25), color: c(live ? "--arena-live" : "--arena-muted") }}>
          ● {live ? "LIVE" : "RECONNECTING"}
        </span>
        <button type="button" aria-label="Full screen" onClick={() => void document.documentElement.requestFullscreen?.()} className="rounded-lg border p-2" style={{ borderColor: c("--arena-border") }}>
          <Maximize2 className="h-4 w-4" />
        </button>
      </header>

      {board.columns.length === 0 ? (
        <p className="mt-10 text-center text-sm" style={{ color: c("--arena-muted") }}>This session has no question cards yet.</p>
      ) : (
        <>
          <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
            <div className="flex flex-col items-center">
              {current && <Wheel cols={current.items} flash={flash} />}
              {pages.length > 1 && (
                <div className="mt-2 flex gap-2">
                  {pages.map((p, i) => (
                    <button key={p.label} type="button" onClick={() => setPage(i)} className="rounded-full border px-3 py-1 text-xs font-semibold" style={{ borderColor: c("--arena-gold"), background: i === page ? c("--arena-gold") : "transparent", color: i === page ? c("--arena-bg") : c("--arena-ink") }}>{p.label}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex snap-x gap-3 overflow-x-auto pb-2">
              {(current?.items ?? []).map((q, i) => (
                <div key={q.assessmentId} className="snap-start"><Column q={q} i={(current?.start ?? 0) + i} flash={flash.has(q.assessmentId)} /></div>
              ))}
            </div>
          </section>
          <footer className="mt-4 flex flex-wrap gap-2 text-xs">
            {[
              [<Trophy key="t" className="h-3.5 w-3.5" />, "Fastest Correct Answers Only"],
              [null, "Each Question Shows Top 5 Students"],
              [<Users key="u" className="h-3.5 w-3.5" />, `${shown} of ${board.joined} Participants Shown`],
            ].map(([icon, label]) => (
              <span key={String(label)} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5" style={{ borderColor: c("--arena-border") }}>{icon}{label}</span>
            ))}
          </footer>
        </>
      )}
    </main>
  );
};

export default ArenaLivePage;
