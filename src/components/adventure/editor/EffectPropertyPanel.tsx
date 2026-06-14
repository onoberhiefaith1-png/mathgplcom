import { useState } from "react";
import { ChevronDown, ChevronRight, Route, X } from "lucide-react";
import type { LayoutItem, MotionType, BlendMode, TriggerEvent, ExitBehavior } from "@/lib/adventure/types";
import { withEffectDefaults } from "@/lib/adventure/effectDefaults";
import EffectTimelineEditor from "./EffectTimelineEditor";

interface Props {
  item: LayoutItem;
  onChange: (patch: Partial<LayoutItem>) => void;
  onClose: () => void;
  onLayer: (op: "front" | "back" | "forward" | "backward") => void;
  onTogglePathEdit: () => void;
  pathEditing: boolean;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold hover:bg-accent">
        {title}{open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
      {open && <div className="px-3 pb-3 pt-1 space-y-2">{children}</div>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-16 text-muted-foreground">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export default function EffectPropertyPanel({ item, onChange, onClose, onLayer, onTogglePathEdit, pathEditing }: Props) {
  const def = withEffectDefaults(item);

  const setNum = (k: keyof LayoutItem, v: number) => onChange({ [k]: v } as Partial<LayoutItem>);

  return (
    <div className="flex h-full w-72 flex-col border-l bg-card text-xs overflow-y-auto">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="font-semibold truncate">{item.label || "Effect"}</div>
        <button onClick={onClose} className="rounded p-1 hover:bg-accent"><X className="h-3 w-3" /></button>
      </div>

      <Section title="Transform">
        <Row label="X"><input type="range" min={0} max={100} value={item.x} onChange={(e) => setNum("x", +e.target.value)} className="w-full" /></Row>
        <Row label="Y"><input type="range" min={0} max={100} value={item.y} onChange={(e) => setNum("y", +e.target.value)} className="w-full" /></Row>
        <Row label="Width"><input type="range" min={4} max={100} value={item.w} onChange={(e) => setNum("w", +e.target.value)} className="w-full" /></Row>
        <Row label="Height"><input type="range" min={4} max={100} value={item.h} onChange={(e) => setNum("h", +e.target.value)} className="w-full" /></Row>
        <Row label="Rotate">
          <input type="range" min={0} max={360} value={def.rotation} onChange={(e) => setNum("rotation", +e.target.value)} className="w-full" />
        </Row>
        <div className="flex gap-1">
          {[0, 90, 180, 270].map((d) => (
            <button key={d} onClick={() => setNum("rotation", d)} className="flex-1 rounded border px-1 py-0.5 hover:bg-accent">{d}°</button>
          ))}
        </div>
        <Row label="Opacity">
          <input type="range" min={0} max={100} value={Math.round(def.opacity * 100)} onChange={(e) => onChange({ opacity: +e.target.value / 100 })} className="w-full" />
        </Row>
        <div className="flex gap-1 pt-1">
          <span className="w-16 text-muted-foreground text-[10px]">Scale</span>
          {[50, 100, 150, 200, 300].map((s) => (
            <button key={s}
              onClick={() => {
                const base = Math.max(item.w, item.h);
                const factor = (s / 100) / (base / 30);
                onChange({ w: Math.min(100, item.w * factor), h: Math.min(100, item.h * factor) });
              }}
              className="flex-1 rounded border px-1 py-0.5 hover:bg-accent text-[10px]"
            >{s}%</button>
          ))}
        </div>
      </Section>

      <Section title="Layer & Blend">
        <div className="grid grid-cols-2 gap-1">
          <button onClick={() => onLayer("front")} className="rounded border px-2 py-1 hover:bg-accent">To Front</button>
          <button onClick={() => onLayer("forward")} className="rounded border px-2 py-1 hover:bg-accent">Forward</button>
          <button onClick={() => onLayer("backward")} className="rounded border px-2 py-1 hover:bg-accent">Backward</button>
          <button onClick={() => onLayer("back")} className="rounded border px-2 py-1 hover:bg-accent">To Back</button>
        </div>
        <Row label="Blend">
          <select className="w-full rounded border bg-background px-1 py-0.5"
            value={def.blendMode}
            onChange={(e) => onChange({ blendMode: e.target.value as BlendMode })}
          >
            {(["screen", "normal", "multiply", "lighten"] as const).map((m) => <option key={m}>{m}</option>)}
          </select>
        </Row>
      </Section>

      <Section title="Motion">
        <Row label="Type">
          <select className="w-full rounded border bg-background px-1 py-0.5"
            value={def.motion.type}
            onChange={(e) => onChange({ motion: { ...def.motion, type: e.target.value as MotionType } })}
          >
            {(["static","left","right","up","down","circle","figure8","random","path"] as const).map((t) => <option key={t}>{t}</option>)}
          </select>
        </Row>
        <Row label="Speed">
          <div className="flex gap-1">
            {[0.5, 1, 2, 4].map((s) => (
              <button key={s} onClick={() => onChange({ motion: { ...def.motion, speed: s } })}
                className={`flex-1 rounded border px-1 py-0.5 text-[10px] ${def.motion.speed === s ? "bg-primary text-primary-foreground" : ""}`}>{s}×</button>
            ))}
          </div>
        </Row>
        <Row label="Range">
          <input type="range" min={0} max={50} value={def.motion.amplitude}
            onChange={(e) => onChange({ motion: { ...def.motion, amplitude: +e.target.value } })} className="w-full" />
        </Row>
        <button onClick={onTogglePathEdit}
          className={`flex w-full items-center justify-center gap-1 rounded border px-2 py-1 ${pathEditing ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
          <Route className="h-3 w-3" /> {pathEditing ? "Done editing path" : "Edit Path"}
        </button>
      </Section>

      <Section title="Timeline & Playback">
        <EffectTimelineEditor item={item} onChange={onChange} />
      </Section>

      <Section title="Trigger">
        <Row label="Start">
          <select className="w-full rounded border bg-background px-1 py-0.5"
            value={def.trigger.start}
            onChange={(e) => onChange({ trigger: { ...def.trigger, start: e.target.value as TriggerEvent } })}
          >
            {(["always","sceneStart","questionSolved","obstacleCleared","doorOpened","vaultOpened","sceneComplete","custom"] as const).map((t) => <option key={t}>{t}</option>)}
          </select>
        </Row>
        <Row label="Delay">
          <div className="flex gap-1">
            {[0, 1, 2, 5, 10].map((d) => (
              <button key={d} onClick={() => onChange({ trigger: { ...def.trigger, delay: d } })}
                className={`flex-1 rounded border px-1 py-0.5 text-[10px] ${def.trigger.delay === d ? "bg-primary text-primary-foreground" : ""}`}>{d}s</button>
            ))}
          </div>
        </Row>
        <Row label="Exit on">
          <select className="w-full rounded border bg-background px-1 py-0.5"
            value={def.trigger.exitOn ?? ""}
            onChange={(e) => onChange({ trigger: { ...def.trigger, exitOn: (e.target.value || undefined) as TriggerEvent | undefined } })}
          >
            <option value="">— never —</option>
            {(["sceneComplete","questionSolved","obstacleCleared","doorOpened","vaultOpened","custom"] as const).map((t) => <option key={t}>{t}</option>)}
          </select>
        </Row>
        <Row label="Exit fx">
          <select className="w-full rounded border bg-background px-1 py-0.5"
            value={def.trigger.exitBehavior}
            onChange={(e) => onChange({ trigger: { ...def.trigger, exitBehavior: e.target.value as ExitBehavior } })}
          >
            {(["instant","fade","shrink","explode","playExit","custom"] as const).map((t) => <option key={t}>{t}</option>)}
          </select>
        </Row>
      </Section>
    </div>
  );
}
