import { useEffect, useState } from "react";
import { X, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import type { LabSnapshot } from "@/lib/graphApp/savedGraphs";
import { saveMathLabScene, listMyMathLabScenes, deleteMathLabScene, type SceneControls } from "@/lib/graphApp/scenes.functions";

interface Props {
  userId: string | null;
  snapshot: LabSnapshot;
  onLoad: (s: LabSnapshot) => void;
  onClose: () => void;
}

interface ClassRow { id: string; name: string }
interface SceneRow { id: string; name: string; updated_at: string; controls: SceneControls; snapshot: LabSnapshot; math_lab_scene_shares: { class_id: string }[] }

/** Teacher cloud save/share: name a scene, pick classes, choose what students may touch. */
export default function SharePanel({ userId, snapshot, onLoad, onClose }: Props) {
  const [name, setName] = useState("");
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [controls, setControls] = useState<SceneControls>({ editEquations: true, tools: true, console: false });
  const [scenes, setScenes] = useState<SceneRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = () => listMyMathLabScenes().then((rows) => setScenes(rows as SceneRow[])).catch(() => setScenes([]));

  useEffect(() => {
    if (!userId) return;
    supabase.from("classes").select("id, name").eq("owner_id", userId).order("name").then(({ data }) => setClasses(data ?? []));
    refresh();
  }, [userId]);

  const save = async () => {
    if (!name.trim()) { setMessage("Give the scene a name first."); return; }
    setBusy(true); setMessage(null);
    try {
      await saveMathLabScene({ data: { name: name.trim(), snapshot, controls, classIds: [...picked] } });
      setName(""); setPicked(new Set()); setMessage("Scene saved and shared.");
      refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not save the scene."); }
    finally { setBusy(false); }
  };

  return (
    <aside className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto rounded-xl border bg-card p-3 max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-20 max-lg:shadow-xl max-sm:w-full">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Share with a class</h2>
        <button aria-label="Close share panel" onClick={onClose}><X className="h-4 w-4" /></button>
      </div>

      <label className="text-sm font-medium">Scene name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Plane intersections demo"
          className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm outline-none" />
      </label>

      <div>
        <p className="mb-1 text-sm font-medium">Classes</p>
        {classes.length === 0 && <p className="text-xs text-muted-foreground">You have no classes yet. Create one from the Classes page, then share.</p>}
        <ul className="max-h-32 space-y-1 overflow-y-auto">
          {classes.map((c) => (
            <li key={c.id}>
              <label className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm">
                <input type="checkbox" checked={picked.has(c.id)}
                  onChange={(e) => setPicked((p) => { const n = new Set(p); e.target.checked ? n.add(c.id) : n.delete(c.id); return n; })} />
                {c.name}
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium">Students may…</p>
        {([
          ["editEquations", "Change and add equations"],
          ["tools", "Use the drawing tools"],
          ["console", "Open the console"],
        ] as [keyof SceneControls, string][]).map(([key, label]) => (
          <label key={key} className="flex items-center justify-between text-sm">{label}
            <Switch checked={controls[key]} onCheckedChange={(v) => setControls((c) => ({ ...c, [key]: v }))} />
          </label>
        ))}
      </div>

      <Button onClick={save} disabled={busy || !userId}>{busy ? "Saving…" : "Save & share"}</Button>
      {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}

      <div className="border-t pt-2">
        <p className="mb-1 flex items-center gap-1 text-sm font-medium"><Users className="h-4 w-4" /> My shared scenes</p>
        <ul className="space-y-1">
          {scenes.map((s) => (
            <li key={s.id} className="flex items-center gap-1 rounded-md border px-2 py-1 text-sm">
              <button className="min-w-0 flex-1 truncate text-left" title="Open this scene"
                onClick={() => { if (s.snapshot) onLoad(s.snapshot); }}>
                {s.name}
              </button>
              <span className="text-xs text-muted-foreground">{s.math_lab_scene_shares?.length ?? 0} class{(s.math_lab_scene_shares?.length ?? 0) === 1 ? "" : "es"}</span>
              <Button variant="ghost" size="icon-xs" aria-label={`Delete ${s.name}`}
                onClick={() => deleteMathLabScene({ data: { id: s.id } }).then(refresh)}><Trash2 /></Button>
            </li>
          ))}
          {scenes.length === 0 && <li className="text-xs text-muted-foreground">Nothing shared yet.</li>}
        </ul>
      </div>
    </aside>
  );
}
