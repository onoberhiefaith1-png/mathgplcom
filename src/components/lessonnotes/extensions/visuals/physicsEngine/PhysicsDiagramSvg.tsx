// Renders a Physics Diagram Engine model as a clean, legible SVG.
import type { ReactNode } from "react";
import type { PhysicsDiagramModel, PhysicsItem } from "@/lib/lessonnotes/ai/physicsDiagram";

const INK = "currentColor";
const T = (x: number, y: number, s: string, anchor: "start" | "middle" | "end" = "middle", size = 13) => (
  <text x={x} y={y} textAnchor={anchor} fontSize={size} fill={INK} style={{ fontFamily: "inherit" }}>{s}</text>
);
const Arrow = ({ id }: { id: string }) => (
  <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M0 0 L10 5 L0 10 Z" fill={INK} />
  </marker>
);

function FreeBody({ m, uid }: { m: PhysicsDiagramModel; uid: string }) {
  const cx = 160, cy = 110, half = 30;
  const vec: Record<string, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  return (
    <>
      <rect x={cx - half} y={cy - half} width={half * 2} height={half * 2} rx={4} fill="none" stroke={INK} strokeWidth={2} />
      {T(cx, cy + 4, m.meta.body ?? "Body", "middle", 12)}
      {m.items.map((f) => {
        const [dx, dy] = vec[f.dir ?? "down"];
        const x1 = cx + dx * half, y1 = cy + dy * half, x2 = cx + dx * (half + 60), y2 = cy + dy * (half + 60);
        return (
          <g key={f.id}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={2} markerEnd={`url(#${uid})`} />
            {T(x2 + dx * 8 + (dy ? 8 : 0), y2 + dy * 14 + (dx ? -6 : 0), f.label, dx < 0 ? "end" : dy ? "start" : "start", 12)}
          </g>
        );
      })}
    </>
  );
}

function Component({ c, x, y }: { c: PhysicsItem; x: number; y: number }): ReactNode {
  switch (c.type) {
    case "cell": case "battery":
      return <g><rect x={x - 12} y={y - 16} width={24} height={32} fill="var(--background, white)" stroke="none" />
        <line x1={x - 5} y1={y - 14} x2={x - 5} y2={y + 14} stroke={INK} strokeWidth={2} />
        <line x1={x + 5} y1={y - 7} x2={x + 5} y2={y + 7} stroke={INK} strokeWidth={4} /></g>;
    case "resistor": case "rheostat": case "fuse":
      return <rect x={x - 20} y={y - 8} width={40} height={16} fill="var(--background, white)" stroke={INK} strokeWidth={2} />;
    case "lamp": case "bulb":
      return <g><circle cx={x} cy={y} r={11} fill="var(--background, white)" stroke={INK} strokeWidth={2} />
        <line x1={x - 8} y1={y - 8} x2={x + 8} y2={y + 8} stroke={INK} strokeWidth={1.5} />
        <line x1={x - 8} y1={y + 8} x2={x + 8} y2={y - 8} stroke={INK} strokeWidth={1.5} /></g>;
    case "switch":
      return <g><rect x={x - 16} y={y - 4} width={32} height={8} fill="var(--background, white)" stroke="none" />
        <circle cx={x - 14} cy={y} r={2.5} fill={INK} /><circle cx={x + 14} cy={y} r={2.5} fill={INK} />
        <line x1={x - 14} y1={y} x2={x + 10} y2={y - 12} stroke={INK} strokeWidth={2} /></g>;
    case "ammeter": case "voltmeter":
      return <g><circle cx={x} cy={y} r={12} fill="var(--background, white)" stroke={INK} strokeWidth={2} />
        {T(x, y + 4.5, c.type === "ammeter" ? "A" : "V", "middle", 13)}</g>;
    default:
      return <rect x={x - 14} y={y - 8} width={28} height={16} fill="none" stroke={INK} strokeDasharray="3 2" />;
  }
}

function Circuit({ m }: { m: PhysicsDiagramModel }) {
  const series = m.items.filter((x) => x.placement !== "parallel");
  const parallel = m.items.filter((x) => x.placement === "parallel");
  const L = 40, R = 280, Tp = 50, B = 170;
  const top = series.slice(0, Math.ceil(series.length / 2));
  const bottom = series.slice(top.length);
  const pos = new Map<string, [number, number]>();
  top.forEach((c, i) => pos.set(c.id, [L + ((R - L) * (i + 1)) / (top.length + 1), Tp]));
  bottom.forEach((c, i) => pos.set(c.id, [R - ((R - L) * (i + 1)) / (bottom.length + 1), B]));
  return (
    <>
      <rect x={L} y={Tp} width={R - L} height={B - Tp} fill="none" stroke={INK} strokeWidth={2} />
      {parallel.map((p) => {
        const t = series.find((s) => s.type === p.across.toLowerCase() || s.label === p.across || s.id === p.across);
        const at = t ? pos.get(t.id) : undefined;
        if (!at) return null;
        const [x, y] = at; const dy = y === Tp ? -32 : 32;
        return <g key={p.id}>
          <path d={`M${x - 30} ${y} V${y + dy} H${x + 30} V${y}`} fill="none" stroke={INK} strokeWidth={1.6} />
          <Component c={p} x={x} y={y + dy} />
          {T(x + 20, y + dy + (dy < 0 ? -14 : 24), p.label, "start", 11)}
        </g>;
      })}
      {series.map((c) => {
        const [x, y] = pos.get(c.id)!;
        return <g key={c.id}><Component c={c} x={x} y={y} />{T(x, y === Tp ? y + 30 : y - 20, c.label, "middle", 11)}</g>;
      })}
    </>
  );
}

function Ray({ m, uid }: { m: PhysicsDiagramModel; uid: string }) {
  const reflect = m.meta.mode === "reflection";
  const [i, r] = m.items;
  return reflect ? (
    <>
      <line x1={60} y1={170} x2={260} y2={170} stroke={INK} strokeWidth={3} />
      {T(270, 174, m.meta.medium ?? "Mirror", "start", 11)}
      <line x1={160} y1={40} x2={160} y2={170} stroke={INK} strokeDasharray="5 4" />
      {T(160, 34, "Normal", "middle", 11)}
      <line x1={70} y1={70} x2={160} y2={170} stroke={INK} strokeWidth={2} markerEnd={`url(#${uid})`} />
      <line x1={160} y1={170} x2={250} y2={70} stroke={INK} strokeWidth={2} markerEnd={`url(#${uid})`} />
      {T(140, 120, i?.label ?? "i", "end", 12)}{T(180, 120, r?.label ?? "r", "start", 12)}
    </>
  ) : (
    <>
      <rect x={60} y={110} width={200} height={70} fill="none" stroke={INK} strokeWidth={2} />
      {T(250, 172, m.meta.medium ?? "Glass", "end", 11)}
      <line x1={140} y1={40} x2={140} y2={200} stroke={INK} strokeDasharray="5 4" />
      {T(140, 34, "Normal", "middle", 11)}
      <line x1={80} y1={50} x2={140} y2={110} stroke={INK} strokeWidth={2} markerEnd={`url(#${uid})`} />
      <line x1={140} y1={110} x2={170} y2={180} stroke={INK} strokeWidth={2} markerEnd={`url(#${uid})`} />
      {T(126, 92, i?.label ?? "i", "end", 12)}{T(150, 140, r?.label ?? "r", "start", 12)}
    </>
  );
}

function Wave({ m }: { m: PhysicsDiagramModel; uid: string }) {
  const [lam, amp] = m.items;
  if (m.meta.mode === "longitudinal") {
    const xs: number[] = [];
    for (let k = 0; k < 40; k++) xs.push(40 + k * 6 + 8 * Math.sin((k / 40) * Math.PI * 6));
    return <>
      {xs.map((x, k) => <line key={k} x1={x} y1={80} x2={x} y2={140} stroke={INK} strokeWidth={1.4} />)}
      <path d="M52 160 H124" stroke={INK} markerStart="url(#wv)" markerEnd="url(#wv)" />
      {T(88, 178, lam?.label ?? "λ", "middle", 12)}
    </>;
  }
  let d = "M30 110";
  for (let x = 30; x <= 290; x += 2) d += ` L${x} ${110 - 45 * Math.sin(((x - 30) / 130) * Math.PI * 2)}`;
  return <>
    <line x1={30} y1={110} x2={295} y2={110} stroke={INK} strokeDasharray="4 3" strokeWidth={1} />
    <path d={d} fill="none" stroke={INK} strokeWidth={2} />
    <path d="M62 50 H192" stroke={INK} markerStart="url(#wv)" markerEnd="url(#wv)" />
    {T(127, 44, lam?.label ?? "λ", "middle", 12)}
    <path d="M62 110 V67" stroke={INK} markerStart="url(#wv)" markerEnd="url(#wv)" />
    {T(54, 94, amp?.label ?? "A", "end", 12)}
  </>;
}

function Field({ m, uid }: { m: PhysicsDiagramModel; uid: string }) {
  if (m.items[0]?.type === "wire") {
    return <>
      {[24, 44, 64].map((r) => <circle key={r} cx={160} cy={110} r={r} fill="none" stroke={INK} strokeWidth={1.5} />)}
      <circle cx={160} cy={110} r={6} fill={INK} />
      {T(160, 196, m.items[0].label || "Current into the page", "middle", 11)}
    </>;
  }
  const loops = [30, 55, 80];
  return <>
    {loops.map((h) => <g key={h}>
      <path d={`M110 110 C110 ${110 - h - 20}, 210 ${110 - h - 20}, 210 110`} fill="none" stroke={INK} strokeWidth={1.4} markerEnd={`url(#${uid})`} />
      <path d={`M110 110 C110 ${110 + h + 20}, 210 ${110 + h + 20}, 210 110`} fill="none" stroke={INK} strokeWidth={1.4} markerEnd={`url(#${uid})`} />
    </g>)}
    <rect x={110} y={98} width={50} height={24} fill="var(--background, white)" stroke={INK} strokeWidth={2} />
    <rect x={160} y={98} width={50} height={24} fill="var(--background, white)" stroke={INK} strokeWidth={2} />
    {T(135, 115, "N", "middle", 13)}{T(185, 115, "S", "middle", 13)}
  </>;
}

export function PhysicsDiagramSvg({ model, uid = "phy" }: { model: PhysicsDiagramModel; uid?: string }) {
  const body = model.kind === "freeBody" ? <FreeBody m={model} uid={uid} />
    : model.kind === "circuit" ? <Circuit m={model} />
    : model.kind === "ray" ? <Ray m={model} uid={uid} />
    : model.kind === "wave" ? <Wave m={model} uid={uid} />
    : <Field m={model} uid={uid} />;
  return (
    <svg viewBox="0 0 320 230" className="w-full h-auto text-foreground" role="img" aria-label={model.title}>
      <defs><Arrow id={uid} /><Arrow id="wv" /></defs>
      {body}
      {T(160, 224, model.title, "middle", 12)}
    </svg>
  );
}
