import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUp, ArrowDown, Copy, Trash2, Image as ImageIcon, Plus, Sparkles, ListChecks, Maximize2 } from "lucide-react";
import DraggableResizable from "./DraggableResizable";
import BackgroundLibraryModal from "./BackgroundLibraryModal";
import EffectPropertyPanel from "./EffectPropertyPanel";
import EffectPathEditor from "./EffectPathEditor";
import SceneCameraPanel from "./SceneCameraPanel";
import { withEffectDefaults } from "@/lib/adventure/effectDefaults";
import { useEffectMotion } from "@/lib/adventure/motionEngine";
import { resolveBackgroundUrl } from "@/lib/adventure/backgrounds";
import { ensureSceneNotebook, getGame, updateScene } from "@/lib/adventure/api";
import type { AdventureScene, LayoutItem, SceneCamera } from "@/lib/adventure/types";
import { toast } from "@/hooks/use-toast";

interface Props {
  scene: AdventureScene;
  index: number;
  total: number;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onLocalUpdate: (patch: Partial<AdventureScene>) => void;
}

export default function SceneFrame({ scene, index, total, onMove, onDuplicate, onDelete, onLocalUpdate }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const frameRef = useRef<HTMLDivElement>(null);
  const [bgOpen, setBgOpen] = useState(false);
  const [openingQuestions, setOpeningQuestions] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [title, setTitle] = useState(scene.title ?? "");
  const [required, setRequired] = useState(scene.required_progress ?? 0);
  const [pathEditing, setPathEditing] = useState(false);
  const [cameraAnim, setCameraAnim] = useState<{ on: boolean; t: number }>({ on: false, t: 0 });

  const bgUrl = resolveBackgroundUrl(scene.background_ref);
  const camera = (scene.config?.camera as SceneCamera | undefined);

  const persist = async (patch: Partial<AdventureScene>) => {
    try { await updateScene(scene.id, patch); onLocalUpdate(patch); }
    catch (e: unknown) { toast({ title: "Save failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" }); }
  };

  useEffect(() => { setTitle(scene.title ?? ""); setRequired(scene.required_progress ?? 0); }, [scene.id]);

  const updateItem = (id: string, patch: Partial<LayoutItem>) => {
    const items = scene.layout_json.items.map((it) => (it.id === id ? { ...it, ...patch } : it));
    persist({ layout_json: { items } });
  };

  const addItem = (item: LayoutItem) => {
    persist({ layout_json: { items: [...scene.layout_json.items, item] } });
  };

  const removeItem = (id: string) => {
    persist({ layout_json: { items: scene.layout_json.items.filter((i) => i.id !== id) } });
    if (selected === id) setSelected(null);
  };

  const openEffectLibrary = () => {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    const search = new URLSearchParams({
      adventurePicker: "video-fx",
      returnTo,
      sceneId: scene.id,
    });

    navigate(
      { pathname: "/assets/effects/video-fx", search: `?${search.toString()}` },
      {
        state: {
          adventureVideoFxPicker: {
            returnTo,
            sceneId: scene.id,
          },
        },
      },
    );
  };

  const addProgress = () => {
    addItem({ id: crypto.randomUUID(), kind: "progress", label: "Progress", x: 35, y: 70, w: 30, h: 12 });
  };
  const addVault = (label: string) => {
    addItem({ id: crypto.randomUUID(), kind: "vault", label, vaultId: crypto.randomUUID().slice(0, 6), reward: 50, x: 10, y: 30, w: 22, h: 30 });
  };

  const layerOp = (id: string, op: "front" | "back" | "forward" | "backward") => {
    const items = scene.layout_json.items;
    const sorted = [...items].sort((a, b) => (a.zIndex ?? 1) - (b.zIndex ?? 1));
    const max = sorted.length > 0 ? (sorted[sorted.length - 1].zIndex ?? 1) : 1;
    const min = sorted.length > 0 ? (sorted[0].zIndex ?? 1) : 1;
    const cur = items.find((i) => i.id === id);
    if (!cur) return;
    let z = cur.zIndex ?? 1;
    if (op === "front") z = max + 1;
    else if (op === "back") z = min - 1;
    else if (op === "forward") z = z + 1;
    else z = z - 1;
    updateItem(id, { zIndex: z });
  };

  const openQuestions = async () => {
    if (openingQuestions) return;
    setOpeningQuestions(true);
    try {
      const game = await getGame(scene.game_id);
      const notebookId = await ensureSceneNotebook({ scene, game });
      if (!scene.notebook_id) onLocalUpdate({ notebook_id: notebookId });
      navigate(`/lesson-notes/${notebookId}`);
    } catch (e: unknown) {
      toast({ title: "Could not open questions", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setOpeningQuestions(false);
    }
  };

  const selectedItem = scene.layout_json.items.find((i) => i.id === selected);
  const isEffectSelected = selectedItem?.kind === "effect";

  useEffect(() => {
    if (!cameraAnim.on || !camera) return;
    const start = performance.now();
    const dur = Math.max(0.1, camera.speed) * 1000;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      setCameraAnim({ on: t < 1, t });
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cameraAnim.on, camera?.speed]);

  const camTransform = (() => {
    if (!camera) return undefined;
    const t = cameraAnim.t;
    const x = camera.startX + (camera.endX - camera.startX) * t;
    const y = camera.startY + (camera.endY - camera.startY) * t;
    const z = camera.zoomStart + (camera.zoomEnd - camera.zoomStart) * t;
    return `translate(${-x}%, ${-y}%) scale(${z})`;
  })();

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-2 rounded-t-lg border border-b-0 bg-card p-2">
        <span className="text-xs font-semibold text-muted-foreground px-2 py-1 rounded bg-muted">Scene {index + 1}</span>
        <span className="text-xs uppercase tracking-wide px-2 py-1 rounded bg-primary/10 text-primary">{scene.kind}</span>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== (scene.title ?? "") && persist({ title })}
          placeholder="Scene title"
          className="h-7 flex-1 min-w-[140px]"
        />
        {scene.kind === "obstacle" && (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground">Required</span>
            <Input
              type="number"
              value={required}
              onChange={(e) => setRequired(parseInt(e.target.value) || 0)}
              onBlur={() => required !== scene.required_progress && persist({ required_progress: required })}
              className="h-7 w-20"
            />
          </div>
        )}
        <div className="ml-auto flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">Scale</span>
          <input type="range" min={0.5} max={1.4} step={0.05} value={scale} onChange={(e) => setScale(parseFloat(e.target.value))} />
          <Button size="icon" variant="ghost" disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" disabled={index === total - 1} onClick={() => onMove(1)}><ArrowDown className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={onDuplicate}><Copy className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border border-b-0 bg-card/60 p-2 text-xs">
        <Button size="sm" variant="outline" onClick={() => setBgOpen(true)}><ImageIcon className="h-3.5 w-3.5 mr-1" /> Background</Button>
        <Button size="sm" variant="outline" onClick={openEffectLibrary}><Sparkles className="h-3.5 w-3.5 mr-1" /> Add Effect</Button>
        {scene.kind === "door" && (
          <Button size="sm" variant="outline" onClick={addProgress}><Plus className="h-3.5 w-3.5 mr-1" /> Add Progress Container</Button>
        )}
        {scene.kind === "vault" && (
          <>
            <Button size="sm" variant="outline" onClick={() => addVault("Diamond Vault")}>+ Diamond</Button>
            <Button size="sm" variant="outline" onClick={() => addVault("Gold Vault")}>+ Gold</Button>
            <Button size="sm" variant="outline" onClick={() => addVault("Silver Vault")}>+ Silver</Button>
            <Button size="sm" variant="outline" onClick={() => addVault("Bronze Vault")}>+ Bronze</Button>
          </>
        )}
        <Button size="sm" onClick={openQuestions} disabled={openingQuestions}>
          <ListChecks className="h-3.5 w-3.5 mr-1" /> {openingQuestions ? "Opening…" : "Questions"}
        </Button>
        <div className="ml-auto">
          <SceneCameraPanel
            camera={camera}
            onChange={(c) => persist({ config: { ...(scene.config ?? {}), camera: c } })}
            onPreview={() => setCameraAnim({ on: true, t: 0 })}
          />
        </div>
      </div>

      <div className="rounded-b-lg border bg-card p-3" style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <div className="flex gap-3">
          <div className="flex-1 overflow-hidden">
            <div
              ref={frameRef}
              onPointerDown={() => { if (!pathEditing) setSelected(null); }}
              className="relative aspect-video w-full overflow-hidden rounded-md bg-muted"
              style={bgUrl ? { backgroundImage: `url(${bgUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
            >
              <div className="absolute inset-0" style={{ transform: camTransform, transformOrigin: "center center", transition: cameraAnim.on ? "none" : "transform 0.3s" }}>
                {!bgUrl && (
                  <button onClick={() => setBgOpen(true)} className="absolute inset-0 flex items-center justify-center text-muted-foreground hover:text-foreground">
                    <span className="rounded-md border-2 border-dashed border-border px-4 py-2 text-sm">Click to choose background</span>
                  </button>
                )}

                {[...scene.layout_json.items]
                  .sort((a, b) => (a.zIndex ?? 1) - (b.zIndex ?? 1))
                  .map((it) => (
                  <DraggableResizable
                    key={it.id}
                    x={it.x} y={it.y} w={it.w} h={it.h}
                    selected={selected === it.id}
                    onSelect={() => setSelected(it.id)}
                    onChange={(v) => updateItem(it.id, v)}
                    containerRef={frameRef}
                    hideIdleOutline={it.kind === "effect"}
                  >
                    <ItemBody item={it} onOpenQuestions={openQuestions} onRemove={() => removeItem(it.id)} selected={selected === it.id} />
                  </DraggableResizable>
                ))}

                {isEffectSelected && selectedItem && (
                  <EffectPathEditor
                    item={selectedItem}
                    onChange={(p) => updateItem(selectedItem.id, p)}
                    frameEl={frameRef.current}
                    active={pathEditing}
                    onClose={() => setPathEditing(false)}
                  />
                )}
              </div>
            </div>
          </div>

          {isEffectSelected && selectedItem && (
            <EffectPropertyPanel
              key={selectedItem.id}
              item={selectedItem}
              onChange={(patch) => updateItem(selectedItem.id, patch)}
              onClose={() => setSelected(null)}
              onLayer={(op) => layerOp(selectedItem.id, op)}
              onTogglePathEdit={() => setPathEditing((v) => !v)}
              pathEditing={pathEditing}
            />
          )}
        </div>
      </div>

      <BackgroundLibraryModal open={bgOpen} onClose={() => setBgOpen(false)} onPick={(ref) => persist({ background_ref: ref })} />
    </div>
  );
}

function ItemBody({ item, onOpenQuestions, onRemove, selected }: { item: LayoutItem; onOpenQuestions: () => void; onRemove: () => void; selected: boolean }) {
  return (
    <div className="relative h-full w-full">
      {item.kind === "effect" && item.src && <EffectVideo item={item} />}
      {item.kind === "progress" && (
        <div className="flex h-full w-full flex-col justify-center rounded bg-background/70 p-2 backdrop-blur">
          <div className="text-[10px] font-semibold mb-1">{item.label}</div>
          <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full w-1/3 bg-primary" /></div>
        </div>
      )}
      {item.kind === "vault" && (
        <div className="flex h-full w-full flex-col items-center justify-center rounded bg-gradient-to-b from-amber-500/30 to-amber-900/40 text-white">
          <Maximize2 className="h-6 w-6 mb-1 opacity-80" />
          <div className="text-xs font-bold drop-shadow">{item.label}</div>
          <div className="text-[10px] opacity-80">Reward {item.reward}</div>
          {selected && (
            <button onClick={(e) => { e.stopPropagation(); onOpenQuestions(); }} className="mt-1 text-[10px] underline">Edit questions</button>
          )}
        </div>
      )}
      {selected && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute -top-2 -right-2 rounded-full bg-destructive p-1 text-destructive-foreground"
          title="Remove"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function EffectVideo({ item }: { item: LayoutItem }) {
  const def = withEffectDefaults(item);
  const { dx, dy } = useEffectMotion(def.motion);
  return (
    <video
      src={item.src}
      autoPlay
      muted
      loop
      playsInline
      className="pointer-events-none h-full w-full object-cover"
      style={{
        mixBlendMode: def.blendMode,
        opacity: def.opacity,
        transform: `translate(${dx}%, ${dy}%) rotate(${def.rotation}deg)`,
        transformOrigin: "center center",
        zIndex: def.zIndex,
      }}
    />
  );
}

