// Development-only performance readout. Never rendered in a published game.

import { useSyncExternalStore } from "react";
import { perfSnapshot, resetWorst, subscribePerf } from "@/lib/slate/vfx/perf";

export function EffectPerfOverlay() {
  const perf = useSyncExternalStore(subscribePerf, perfSnapshot, perfSnapshot);
  if (!import.meta.env.DEV) return null;
  const rows: Array<[string, string]> = [
    ["FPS", String(perf.fps)],
    ["Frame", `${perf.frameMs} ms`],
    ["Worst (p95)", `${perf.worstMs} ms`],
    ["Draw calls", String(perf.drawCalls)],
    ["Programs", String(perf.programs)],
    ["Meshes", String(perf.meshes)],
    ["Materials", String(perf.materials)],
    ["Textures", String(perf.textures)],
    ["Geometries", String(perf.geometries)],
    ["Heap", `${perf.heapMb} MB`],
    ["Triangles", String(perf.triangles)],
    ["Active effects", String(perf.activeEffects)],
    ["Animation loops", String(perf.loops)],
    ["Asset ready", `${perf.readyLabel} · ${perf.readyMs} ms`],
  ];
  return (
    <div
      data-testid="perf-overlay"
      className="pointer-events-auto absolute right-2 top-2 z-50 w-48 rounded border border-emerald-300/30 bg-black/75 p-2 font-mono text-[10px] leading-relaxed text-emerald-100"
    >
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-2">
          <span className="text-emerald-200/60">{label}</span>
          <span data-testid={`perf-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`}>{value}</span>
        </div>
      ))}
      <button
        type="button"
        onClick={resetWorst}
        className="mt-1 w-full rounded border border-emerald-300/30 px-1 py-0.5 uppercase tracking-wider hover:bg-emerald-300/10"
      >
        Clear worst
      </button>
    </div>
  );
}
