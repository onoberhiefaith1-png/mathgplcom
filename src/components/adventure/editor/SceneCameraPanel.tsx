import { useState } from "react";
import { Camera, Play, X } from "lucide-react";
import type { SceneCamera } from "@/lib/adventure/types";

interface Props {
  camera: SceneCamera | undefined;
  onChange: (c: SceneCamera) => void;
  onPreview: () => void;
}

const DEFAULT: SceneCamera = { startX: 0, startY: 0, endX: 0, endY: 0, speed: 4, zoomStart: 1, zoomEnd: 1 };

export default function SceneCameraPanel({ camera, onChange, onPreview }: Props) {
  const [open, setOpen] = useState(false);
  const c = camera ?? DEFAULT;
  const set = (patch: Partial<SceneCamera>) => onChange({ ...c, ...patch });

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1 rounded border bg-background px-2 py-1 text-xs hover:bg-accent">
        <Camera className="h-3 w-3" /> Camera
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-1 w-64 rounded-md border bg-popover p-3 text-xs shadow-md">
          <div className="flex items-center justify-between mb-2"><span className="font-semibold">Camera</span>
            <button onClick={() => setOpen(false)}><X className="h-3 w-3" /></button>
          </div>
          {[
            ["Start X", c.startX, (v: number) => set({ startX: v }), -50, 50],
            ["Start Y", c.startY, (v: number) => set({ startY: v }), -50, 50],
            ["End X", c.endX, (v: number) => set({ endX: v }), -50, 50],
            ["End Y", c.endY, (v: number) => set({ endY: v }), -50, 50],
            ["Speed (s)", c.speed, (v: number) => set({ speed: v }), 0.5, 30],
            ["Zoom Start", c.zoomStart, (v: number) => set({ zoomStart: v }), 0.5, 3],
            ["Zoom End", c.zoomEnd, (v: number) => set({ zoomEnd: v }), 0.5, 3],
          ].map(([label, value, fn, min, max]) => (
            <div key={label as string} className="mb-1.5">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{label as string}</span><span>{(value as number).toFixed(2)}</span>
              </div>
              <input type="range" min={min as number} max={max as number} step={0.1}
                value={value as number} onChange={(e) => (fn as (v: number) => void)(+e.target.value)} className="w-full" />
            </div>
          ))}
          <button onClick={onPreview} className="mt-2 flex w-full items-center justify-center gap-1 rounded border px-2 py-1 hover:bg-accent">
            <Play className="h-3 w-3" /> Preview
          </button>
        </div>
      )}
    </div>
  );
}
