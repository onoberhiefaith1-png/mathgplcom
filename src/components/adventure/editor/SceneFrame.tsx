import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUp, ArrowDown, Copy, Trash2, Image as ImageIcon, Plus, Sparkles, ListChecks, Maximize2 } from "lucide-react";
import DraggableResizable from "./DraggableResizable";
import BackgroundLibraryModal from "./BackgroundLibraryModal";
import { ADVENTURE_EFFECTS } from "@/lib/adventure/effects";
import { resolveBackgroundUrl } from "@/lib/adventure/backgrounds";
import { ensureSceneNotebook, getGame, updateScene } from "@/lib/adventure/api";
import type { AdventureScene, LayoutItem } from "@/lib/adventure/types";
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
  const frameRef = useRef<HTMLDivElement>(null);
  const [bgOpen, setBgOpen] = useState(false);
  const [openingQuestions, setOpeningQuestions] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [title, setTitle] = useState(scene.title ?? "");
  const [required, setRequired] = useState(scene.required_progress ?? 0);

  const bgUrl = resolveBackgroundUrl(scene.background_ref);

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

  const addEffect = (url: string, label: string) => {
    addItem({ id: crypto.randomUUID(), kind: "effect", src: url, label, x: 35, y: 30, w: 30, h: 30 });
  };
  const addProgress = () => {
    addItem({ id: crypto.randomUUID(), kind: "progress", label: "Progress", x: 35, y: 70, w: 30, h: 12 });
  };
  const addVault = (label: string) => {
    addItem({ id: crypto.randomUUID(), kind: "vault", label, vaultId: crypto.randomUUID().slice(0, 6), reward: 50, x: 10, y: 30, w: 22, h: 30 });
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


  return (
    <div className="w-full">
      {/* Header */}
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

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border border-b-0 bg-card/60 p-2 text-xs">
        <Button size="sm" variant="outline" onClick={() => setBgOpen(true)}><ImageIcon className="h-3.5 w-3.5 mr-1" /> Background</Button>
        <EffectMenu onPick={addEffect} />
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
      </div>

      {/* Frame */}
      <div className="rounded-b-lg border bg-card p-3" style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <div
          ref={frameRef}
          onPointerDown={() => setSelected(null)}
          className="relative aspect-video w-full overflow-hidden rounded-md bg-muted"
          style={bgUrl ? { backgroundImage: `url(${bgUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        >
          {!bgUrl && (
            <button onClick={() => setBgOpen(true)} className="absolute inset-0 flex items-center justify-center text-muted-foreground hover:text-foreground">
              <span className="rounded-md border-2 border-dashed border-border px-4 py-2 text-sm">Click to choose background</span>
            </button>
          )}

          {scene.layout_json.items.map((it) => (
            <DraggableResizable
              key={it.id}
              x={it.x} y={it.y} w={it.w} h={it.h}
              selected={selected === it.id}
              onSelect={() => setSelected(it.id)}
              onChange={(v) => updateItem(it.id, v)}
              containerRef={frameRef}
            >
              <ItemBody item={it} onOpenQuestions={openQuestions} onRemove={() => removeItem(it.id)} selected={selected === it.id} />
            </DraggableResizable>
          ))}
        </div>
      </div>

      <BackgroundLibraryModal open={bgOpen} onClose={() => setBgOpen(false)} onPick={(ref) => persist({ background_ref: ref })} />
    </div>
  );
}

function ItemBody({ item, onOpenQuestions, onRemove, selected }: { item: LayoutItem; onOpenQuestions: (vaultId?: string) => void; onRemove: () => void; selected: boolean }) {
  return (
    <div className="relative h-full w-full">
      {item.kind === "effect" && item.src && (
        <video src={item.src} autoPlay muted loop playsInline className="h-full w-full rounded object-cover pointer-events-none" />
      )}
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
            <button onClick={(e) => { e.stopPropagation(); onOpenQuestions(item.vaultId); }} className="mt-1 text-[10px] underline">Edit questions</button>
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

function EffectMenu({ onPick }: { onPick: (url: string, label: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}><Sparkles className="h-3.5 w-3.5 mr-1" /> Add Effect</Button>
      {open && (
        <div className="absolute z-30 mt-1 max-h-72 w-64 overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
          {ADVENTURE_EFFECTS.map((e) => (
            <button
              key={e.id}
              onClick={() => { onPick(e.url, e.label); setOpen(false); }}
              className="block w-full text-left rounded px-2 py-1 text-xs hover:bg-accent"
            >{e.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
