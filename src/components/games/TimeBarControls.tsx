// Phase 8 — Time Bar UI. Cyber-Charged countdown bar. Renders a live countdown
// for a given progress element and, when `canControl` is true, exposes teacher
// controls (duration, start, pause/resume, reset). Backed by useTimeBar
// (game_time_bars).
import { useMemo, useState } from "react";
import { useTimeBar } from "@/hooks/useTimeBar";

interface Props {
  gameId: string;
  progressElementId: string;
  label?: string;
  canControl?: boolean;
}

const fmt = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const TimeBarControls = ({ gameId, progressElementId, label, canControl = false }: Props) => {
  const { row, remainingMs, running, start, pause, resume, reset, setDuration } =
    useTimeBar(gameId, progressElementId);
  const [minutes, setMinutes] = useState<string>("");

  const pct = useMemo(() => {
    if (!row) return 0;
    const totalMs = row.duration_seconds * 1000;
    if (totalMs <= 0) return 0;
    return Math.max(0, Math.min(1, remainingMs / totalMs));
  }, [row, remainingMs]);

  const warning = pct <= 0.25 && pct > 0 && running;
  const fillGrad = warning
    ? "linear-gradient(90deg,#e11d48,#f97316)"
    : "linear-gradient(90deg,#4f46e5,#8b5cf6,#22d3ee)";
  const glow = warning ? "225,29,72" : "34,211,238";

  return (
    <div
      className="rounded-2xl border p-4 backdrop-blur-xl"
      style={{
        background: "rgba(15,23,42,0.55)",
        borderColor: "rgba(255,255,255,0.08)",
        fontFamily: "'Space Grotesk', system-ui, sans-serif",
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{
              background: running ? `rgb(${glow})` : "#64748b",
              boxShadow: running ? `0 0 10px rgb(${glow})` : undefined,
              animation: running ? "pulse 1.4s ease-in-out infinite" : undefined,
            }}
          />
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
            {label ?? "Time Remaining"}
          </span>
        </div>
        <span
          className="tabular-nums"
          style={{
            fontFamily: "'Kanit','Space Grotesk',sans-serif",
            fontWeight: 800,
            fontSize: 22,
            color: warning ? "#fda4af" : "#ffffff",
            textShadow: `0 0 10px rgba(${glow},0.5)`,
          }}
        >
          {fmt(remainingMs)}
        </span>
      </div>

      <div
        className="relative h-4 w-full overflow-hidden rounded-full border p-[2px] shadow-inner"
        style={{ background: "rgba(2,6,23,0.9)", borderColor: "rgba(51,65,85,0.7)" }}
      >
        <div
          className="relative h-full rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: `${pct * 100}%`,
            background: fillGrad,
            boxShadow: `0 0 18px rgba(${glow},0.55)`,
          }}
        >
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "linear-gradient(45deg, rgba(255,255,255,0.28) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.28) 50%, rgba(255,255,255,0.28) 75%, transparent 75%)",
              backgroundSize: "18px 18px",
              animation: running ? "tb-slide 1.1s linear infinite" : undefined,
            }}
          />
        </div>
      </div>

      {canControl && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <input
            type="number"
            min={1}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder={`${Math.round((row?.duration_seconds ?? 600) / 60)}m`}
            className="w-20 rounded-md border border-slate-700 bg-slate-900/80 px-2 py-1 text-slate-100 placeholder:text-slate-500"
          />
          <button
            type="button"
            onClick={() => {
              const n = Number(minutes);
              if (Number.isFinite(n) && n > 0) setDuration(n * 60);
            }}
            className="rounded-md border border-slate-700 bg-slate-800/70 px-2 py-1 text-slate-200 hover:bg-slate-700"
          >
            Set
          </button>
          {!row?.started_at ? (
            <button
              type="button"
              onClick={() => start()}
              className="rounded-md bg-gradient-to-r from-indigo-500 to-cyan-400 px-3 py-1 font-semibold text-white shadow-[0_0_14px_rgba(34,211,238,0.4)] hover:opacity-90"
            >
              Start
            </button>
          ) : row.paused_at ? (
            <button
              type="button"
              onClick={() => resume()}
              className="rounded-md bg-gradient-to-r from-indigo-500 to-cyan-400 px-3 py-1 font-semibold text-white shadow-[0_0_14px_rgba(34,211,238,0.4)] hover:opacity-90"
            >
              Resume
            </button>
          ) : (
            <button
              type="button"
              onClick={() => pause()}
              className="rounded-md border border-slate-700 bg-slate-800/70 px-2 py-1 text-slate-200 hover:bg-slate-700"
            >
              Pause
            </button>
          )}
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-md border border-slate-700 bg-slate-800/70 px-2 py-1 text-slate-200 hover:bg-slate-700"
          >
            Reset
          </button>
        </div>
      )}

      <style>{`
        @keyframes tb-slide { from { background-position: 0 0 } to { background-position: 18px 0 } }
        @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.35 } }
      `}</style>
    </div>
  );
};

export default TimeBarControls;
