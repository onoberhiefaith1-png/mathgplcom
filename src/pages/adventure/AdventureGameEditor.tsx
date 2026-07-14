import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Camera, Check, ChevronDown, ChevronUp, Crosshair, HelpCircle,
  Image, Layers, Loader2, Maximize, Minus, Play, Plus, Radio, Sliders,
  TowerControl, Trophy, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import GameCanvas from "@/components/gamebuilder/GameCanvas";
import AssetLibraryModal, { type UrlPick } from "@/components/gamebuilder/AssetLibraryModal";
import SettingsPanel from "@/components/gamebuilder/SettingsPanel";
import SceneStrip from "@/components/gamebuilder/SceneStrip";
import EffectsRail from "@/components/gamebuilder/EffectsRail";
import { getGame, renameGame, saveGameCanvas, updateGameMeta } from "@/lib/games/games";
import { ensureGameQuestionNotebook } from "@/lib/games/gameQuestions";
import { importUrlAsGameAsset, renderPathOf } from "@/lib/games/assets";
import { detectMediaBackground } from "@/lib/games/removeBackground";
import { getSignedUrl } from "@/lib/games/urls";
import { DEFAULT_PRESET_ID } from "@/lib/games/progressPresets";
import {
  AssetKind, CanvasElement, GameAssetRow, Scene,
  defaultAnimation, makeScene, normalizeCanvas, uid,
} from "@/lib/games/types";

const labelForKind = (kind: AssetKind, name?: string) =>
  name || kind.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

const AdventureGameEditor = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [title, setTitle] = useState("Untitled Game");
  const [subtopic, setSubtopic] = useState("");
  const [topic, setTopic] = useState("");
  const [metaOpen, setMetaOpen] = useState(false);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaTopic, setMetaTopic] = useState("");
  const [metaSubtopic, setMetaSubtopic] = useState("");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeKind, setActiveKind] = useState<AssetKind>("background");
  const [assetOpen, setAssetOpen] = useState(false);
  const [energyRefreshKey, setEnergyRefreshKey] = useState(0);
  const energyModeRef = useRef(false);
  const [topBarOpen, setTopBarOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [stageFull, setStageFull] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const loadedRef = useRef(false);
  const stageWrapRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gameId) return;
    getGame(gameId)
      .then((g) => {
        setTitle(g.title);
        setSubtopic(g.subtopic ?? "");
        setTopic(g.topic ?? "");
        const canvas = normalizeCanvas(g.canvas);
        setScenes(canvas.scenes);
        setActiveSceneId(canvas.activeSceneId ?? canvas.scenes[0]?.id ?? null);
        loadedRef.current = true;
        if (!g.topic || !g.subtopic || !g.title || g.title === "Untitled Game") {
          setMetaTitle(g.title === "Untitled Game" ? "" : g.title);
          setMetaTopic(g.topic ?? "");
          setMetaSubtopic(g.subtopic ?? "");
          setMetaOpen(true);
        }
      })
      .catch((e) => {
        console.error(e);
        toast({ title: "Could not load game", variant: "destructive" });
        navigate("/adventure/games");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  useEffect(() => {
    if (!gameId || !loadedRef.current) return;
    setSaving(true);
    const t = setTimeout(async () => {
      try {
        await saveGameCanvas(gameId, { scenes, activeSceneId });
      } catch (e) { console.error(e); } finally { setSaving(false); }
    }, 700);
    return () => clearTimeout(t);
  }, [scenes, activeSceneId, gameId]);

  const activeScene = useMemo(
    () => scenes.find((s) => s.id === activeSceneId) ?? scenes[0] ?? null,
    [scenes, activeSceneId],
  );
  const elements = activeScene?.elements ?? [];
  const activeIndex = scenes.findIndex((s) => s.id === activeScene?.id);

  const selected = useMemo(() => elements.find((e) => e.id === selectedId) ?? null, [elements, selectedId]);

  useEffect(() => { if (selectedId) setDrawerOpen(true); }, [selectedId]);
  useEffect(() => { setSelectedId(null); }, [activeSceneId]);

  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  const setElements = useCallback(
    (updater: (els: CanvasElement[]) => CanvasElement[]) => {
      setScenes((prev) => prev.map((s) => (s.id === (activeSceneId ?? prev[0]?.id) ? { ...s, elements: updater(s.elements) } : s)));
    },
    [activeSceneId],
  );

  const patchActiveScene = useCallback(
    (patch: Partial<Scene>) => {
      setScenes((prev) => prev.map((s) => (s.id === (activeSceneId ?? prev[0]?.id) ? { ...s, ...patch } : s)));
    },
    [activeSceneId],
  );

  const addScene = useCallback(() => {
    setScenes((prev) => { const s = makeScene(prev.length); setActiveSceneId(s.id); return [...prev, s]; });
  }, []);

  const duplicateScene = useCallback((id: string) => {
    setScenes((prev) => {
      const src = prev.find((s) => s.id === id);
      if (!src) return prev;
      const copy: Scene = { ...src, id: uid(), title: `${src.title} copy`, elements: src.elements.map((el) => ({ ...el, id: uid() })) };
      const idx = prev.findIndex((s) => s.id === id);
      const next = [...prev]; next.splice(idx + 1, 0, copy);
      setActiveSceneId(copy.id); return next;
    });
  }, []);

  const deleteScene = useCallback((id: string) => {
    setScenes((prev) => {
      if (prev.length <= 1) return prev;
      const idx = prev.findIndex((s) => s.id === id);
      const next = prev.filter((s) => s.id !== id);
      if (id === activeSceneId) { const neighbor = next[Math.max(0, idx - 1)]; setActiveSceneId(neighbor?.id ?? null); }
      return next;
    });
  }, [activeSceneId]);

  const placeReward = useCallback(
    (opts: { kind: AssetKind; assetId: string; mediaType: CanvasElement["mediaType"]; storagePath: string; source: "storage" | "url"; name?: string; }) => {
      const { kind } = opts;
      const keyable = kind === "reward" || kind === "progress_bar" || kind === "effect";
      const chroma = keyable && opts.mediaType === "video";
      const base: CanvasElement = {
        id: uid(), kind, assetId: opts.assetId, mediaType: opts.mediaType, storagePath: opts.storagePath, source: opts.source,
        label: labelForKind(kind, opts.name),
        x: 0.5, y: 0.5, scale: kind === "progress_bar" ? 0.22 : 0.28, z: 1, rotation: 0, opacity: 1,
        blend: "normal", bgRemoval: chroma ? "chroma" : "none", keyTolerance: chroma ? 0.12 : undefined,
        animation: defaultAnimation(),
        ...(kind === "progress_bar"
          ? { progress: { segments: 10, presetId: DEFAULT_PRESET_ID, totalMarks: 400, currentMarks: 0, fill: 0, glow: 0.5, effectScale: 1, fillStyle: "plain" } }
          : {}),
      };
      setElements((els) => {
        if (kind === "background") {
          const withoutBg = els.filter((e) => e.kind !== "background");
          return [{ ...base, x: 0.5, y: 0.5, scale: 1, z: 0 }, ...withoutBg];
        }
        const maxZ = els.reduce((m, e) => Math.max(m, e.z), 0);
        return [...els, { ...base, z: maxZ + 1 }];
      });
      if (kind !== "background") setSelectedId(base.id);

      if (chroma) {
        (async () => {
          try {
            const url = opts.source === "url" ? opts.storagePath : await getSignedUrl(opts.storagePath);
            if (!url) return;
            const det = await detectMediaBackground(url, "video");
            setScenes((prev) => prev.map((s) => ({
              ...s,
              elements: s.elements.map((e) =>
                e.id === base.id
                  ? det.keyable ? { ...e, keyColor: det.color, bgRemoval: "chroma" } : { ...e, bgRemoval: "none" }
                  : e),
            })));
          } catch (err) { console.error("chroma detection failed", err); }
        })();
      }
    },
    [setElements],
  );

  const addProgressTower = useCallback(() => {
    const base: CanvasElement = {
      id: uid(), kind: "progress_bar", assetId: `preset:${DEFAULT_PRESET_ID}`, mediaType: "image",
      storagePath: "", source: "url", label: "Progress Bar",
      x: 0.85, y: 0.5, scale: 0.18, z: 1, rotation: 0, opacity: 1, blend: "normal", bgRemoval: "none",
      animation: defaultAnimation(),
      progress: { segments: 10, presetId: DEFAULT_PRESET_ID, totalMarks: 400, currentMarks: 0, fill: 0, glow: 0.5, effectScale: 1, fillStyle: "plain" },
    };
    setElements((els) => { const maxZ = els.reduce((m, e) => Math.max(m, e.z), 0); return [...els, { ...base, z: maxZ + 1 }]; });
    setSelectedId(base.id);
  }, [setElements]);

  const applyEnergyToSelected = useCallback(
    (opts: { assetId: string; storagePath: string; mediaType: CanvasElement["mediaType"]; source: "storage" | "url"; }) => {
      const sel = elements.find((e) => e.id === selectedIdRef.current);
      if (!sel || sel.kind !== "progress_bar" || !sel.progress) return false;
      setElements((els) => els.map((e) => e.id === sel.id && e.progress
        ? { ...e, progress: { ...e.progress, fillStyle: "effect", effectAssetId: opts.assetId, effectStoragePath: opts.storagePath, effectMediaType: opts.mediaType, effectSource: opts.source } }
        : e));
      return true;
    },
    [elements, setElements],
  );

  const onPickPreset = useCallback((presetId: string) => {
    const sel = elements.find((e) => e.id === selectedIdRef.current);
    if (sel && sel.kind === "progress_bar" && sel.progress) {
      setElements((els) => els.map((e) => e.id === sel.id && e.progress
        ? { ...e, assetId: `preset:${presetId}`, progress: { ...e.progress, presetId } } : e));
      return;
    }
    const base: CanvasElement = {
      id: uid(), kind: "progress_bar", assetId: `preset:${presetId}`, mediaType: "image",
      storagePath: "", source: "url", label: "Progress Bar",
      x: 0.85, y: 0.5, scale: 0.18, z: 1, rotation: 0, opacity: 1, blend: "normal", bgRemoval: "none",
      animation: defaultAnimation(),
      progress: { segments: 10, presetId, totalMarks: 400, currentMarks: 0, fill: 0, glow: 0.5, effectScale: 1, fillStyle: "plain" },
    };
    setElements((els) => { const maxZ = els.reduce((m, e) => Math.max(m, e.z), 0); return [...els, { ...base, z: maxZ + 1 }]; });
    setSelectedId(base.id);
  }, [elements, setElements]);

  const onPickUploaded = useCallback((asset: GameAssetRow) => {
    const sel = elements.find((e) => e.id === selectedIdRef.current);
    if (asset.kind === "effect" && sel?.kind === "progress_bar" && sel.progress) {
      applyEnergyToSelected({ assetId: asset.id, storagePath: renderPathOf(asset), mediaType: asset.media_type, source: "storage" });
      setEnergyRefreshKey((k) => k + 1);
      return;
    }
    placeReward({ kind: asset.kind, assetId: asset.id, mediaType: asset.media_type, storagePath: renderPathOf(asset), source: "storage", name: asset.title });
  }, [placeReward, applyEnergyToSelected, elements]);

  const onPickUrl = useCallback(async (pick: UrlPick) => {
    if (energyModeRef.current) {
      try {
        const asset = await importUrlAsGameAsset(pick.src, "effect", pick.name);
        applyEnergyToSelected({ assetId: asset.id, storagePath: renderPathOf(asset), mediaType: asset.media_type, source: "storage" });
        setEnergyRefreshKey((k) => k + 1);
        toast({ title: "Energy added", description: "Saved to this game's effects." });
      } catch (e) { console.error(e); toast({ title: "Could not add energy", variant: "destructive" }); }
      return;
    }
    placeReward({ kind: activeKind, assetId: pick.src, mediaType: pick.mediaType, storagePath: pick.src, source: "url", name: pick.name });
  }, [activeKind, placeReward, applyEnergyToSelected, toast]);

  const openAsset = (kind: AssetKind, forEnergy = false) => {
    energyModeRef.current = forEnergy;
    setActiveKind(kind);
    setAssetOpen(true);
  };

  const patchElement = useCallback((patch: Partial<CanvasElement>) => {
    if (!selectedId) return;
    setElements((els) => els.map((e) => (e.id === selectedId ? { ...e, ...patch } : e)));
  }, [selectedId, setElements]);

  const moveElement = useCallback((id: string, x: number, y: number) => {
    const snap = (v: number) => (Math.abs(v - 0.5) < 0.02 ? 0.5 : v);
    setElements((els) => els.map((e) => (e.id === id ? { ...e, x: snap(x), y: snap(y) } : e)));
    setTopBarOpen(false);
  }, [setElements]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setElements((els) => els.filter((e) => e.id !== selectedId));
    setSelectedId(null);
  }, [selectedId, setElements]);

  const duplicateSelected = useCallback(() => {
    if (!selectedId) return;
    setElements((els) => {
      const src = els.find((e) => e.id === selectedId);
      if (!src || src.kind === "background") return els;
      const maxZ = els.reduce((m, e) => Math.max(m, e.z), 0);
      const copy: CanvasElement = { ...src, id: uid(), x: Math.min(1, src.x + 0.04), y: Math.min(1, src.y + 0.04), z: maxZ + 1 };
      queueMicrotask(() => setSelectedId(copy.id));
      return [...els, copy];
    });
  }, [selectedId, setElements]);

  const layer = useCallback((dir: "front" | "back" | "forward" | "backward") => {
    if (!selectedId) return;
    setElements((els) => {
      const maxZ = els.reduce((m, e) => Math.max(m, e.z), 0);
      const nonBg = els.filter((e) => e.kind !== "background");
      const minNonBg = nonBg.reduce((m, e) => Math.min(m, e.z), maxZ);
      return els.map((e) => {
        if (e.id !== selectedId) return e;
        if (dir === "front") return { ...e, z: maxZ + 1 };
        if (dir === "back") return { ...e, z: Math.max(1, minNonBg - 1) };
        if (dir === "forward") return { ...e, z: e.z + 1 };
        return { ...e, z: Math.max(1, e.z - 1) };
      });
    });
  }, [selectedId, setElements]);

  const setCameraTarget = useCallback(() => {
    if (!selectedId) return;
    patchActiveScene({ cameraTargetId: selectedId });
    toast({ title: "Camera target set", description: "Use Focus to frame it." });
  }, [selectedId, patchActiveScene, toast]);

  const focusCamera = useCallback(() => {
    const targetId = activeScene?.cameraTargetId ?? selectedId;
    const target = elements.find((e) => e.id === targetId);
    const wrap = canvasWrapRef.current;
    if (!target || !wrap) { setZoom(1); setPan({ x: 0, y: 0 }); return; }
    const rect = wrap.getBoundingClientRect();
    const z = 1.7;
    const offX = (target.x - 0.5) * rect.width;
    const offY = (target.y - 0.5) * rect.height;
    setZoom(z);
    setPan({ x: -offX * z, y: -offY * z });
  }, [activeScene, selectedId, elements]);

  const enterFullscreen = useCallback(() => {
    const el = stageWrapRef.current;
    setStageFull((f) => {
      const next = !f;
      if (next) el?.requestFullscreen?.().catch(() => {});
      else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setStageFull(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const panning = useRef({ active: false, sx: 0, sy: 0, px: 0, py: 0 });
  const onStagePointerDown = (e: React.PointerEvent) => {
    if (!e.altKey) return;
    e.preventDefault();
    panning.current = { active: true, sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onStagePointerMove = (e: React.PointerEvent) => {
    if (!panning.current.active) return;
    setPan({ x: panning.current.px + (e.clientX - panning.current.sx), y: panning.current.py + (e.clientY - panning.current.sy) });
  };
  const onStagePointerUp = () => { panning.current.active = false; };
  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom((z) => Math.min(3, Math.max(0.3, +(z - e.deltaY * 0.001).toFixed(2))));
  };
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (!selectedIdRef.current) { if (e.key === "Escape") setSelectedId(null); return; }
      const nudge = e.shiftKey ? 0.05 : 0.01;
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSelected(); }
      else if (e.key === "Escape") { setSelectedId(null); }
      else if (e.key === "[") { layer("back"); }
      else if (e.key === "]") { layer("front"); }
      else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const map: Record<string, [number, number]> = {
          ArrowUp: [0, -nudge], ArrowDown: [0, nudge], ArrowLeft: [-nudge, 0], ArrowRight: [nudge, 0],
        };
        const d = map[e.key];
        if (d) setElements((els) => els.map((el) =>
          el.id === selectedIdRef.current ? { ...el, x: Math.min(1, Math.max(0, el.x + d[0])), y: Math.min(1, Math.max(0, el.y + d[1])) } : el));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteSelected, layer, setElements]);

  const saveTitle = async () => { if (!gameId) return; try { await renameGame(gameId, title || "Untitled Game"); } catch (e) { console.error(e); } };
  const saveSubtopic = async () => { if (!gameId) return; try { await updateGameMeta(gameId, { subtopic }); } catch (e) { console.error(e); } };
  const saveTopic = async () => { if (!gameId) return; try { await updateGameMeta(gameId, { topic }); } catch (e) { console.error(e); } };

  const saveMeta = async () => {
    if (!gameId) return;
    const t = metaTitle.trim() || "Untitled Game";
    const tp = metaTopic.trim();
    const st = metaSubtopic.trim();
    setTitle(t); setTopic(tp); setSubtopic(st);
    try { await updateGameMeta(gameId, { title: t, topic: tp, subtopic: st }); } catch (e) { console.error(e); }
    setMetaOpen(false);
  };

  const openQuestions = useCallback(async (element: CanvasElement) => {
    if (!gameId) return;
    try {
      const sharedNotebookId =
        element.progress?.questionNotebookId ??
        scenes.flatMap((s) => s.elements).find((e) => e.progress?.questionNotebookId)?.progress?.questionNotebookId;
      const notebookId = await ensureGameQuestionNotebook({ id: gameId, title, subtopic, topic }, sharedNotebookId);
      const nextScenes = scenes.map((s) => ({
        ...s,
        elements: s.elements.map((e) =>
          e.id === element.id && e.progress ? { ...e, progress: { ...e.progress, questionNotebookId: notebookId } } : e),
      }));
      setScenes(nextScenes);
      await saveGameCanvas(gameId, { scenes: nextScenes, activeSceneId });
      navigate(`/lesson-notes/${notebookId}?game=${gameId}`);
    } catch (e) { console.error(e); toast({ title: "Could not open questions", variant: "destructive" }); }
  }, [gameId, title, subtopic, topic, scenes, activeSceneId, navigate, toast]);

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );

  const slots: { kind: AssetKind; label: string; icon: typeof Image }[] = [
    { kind: "background", label: "Background", icon: Image },
    { kind: "reward", label: "Reward", icon: Trophy },
  ];

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {topBarOpen && (
        <header className="z-20 flex shrink-0 flex-wrap items-center gap-2 border-b border-border/50 bg-background/95 px-4 py-2.5 backdrop-blur">
          <Link to="/adventure/games" className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Games
          </Link>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveTitle} placeholder="Game title"
            className="h-8 max-w-[11rem] border-transparent bg-transparent text-base font-semibold focus-visible:border-border" />
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} onBlur={saveTopic} placeholder="Topic"
            className="h-8 max-w-[9rem] border-transparent bg-transparent text-sm text-muted-foreground focus-visible:border-border" />
          <Input value={subtopic} onChange={(e) => setSubtopic(e.target.value)} onBlur={saveSubtopic} placeholder="Subtopic"
            className="h-8 max-w-[10rem] border-transparent bg-transparent text-sm text-muted-foreground focus-visible:border-border" />
          <div className="mx-1 h-6 w-px bg-border/60" />
          <Button size="sm" variant="ghost" onClick={focusCamera}><Crosshair className="mr-1.5 h-4 w-4" /> Focus</Button>
          <Button size="sm" variant="ghost" onClick={enterFullscreen}><Maximize className="mr-1.5 h-4 w-4" /> Full Screen</Button>
          <div className="mx-1 h-6 w-px bg-border/60" />
          <Button size="sm" variant="ghost" disabled title="Coming soon" className="opacity-60"><Play className="mr-1.5 h-4 w-4" /> Play Preview</Button>
          <Button size="sm" variant="ghost" disabled title="Coming soon" className="opacity-60"><Radio className="mr-1.5 h-4 w-4" /> Live</Button>
          <div className="ml-auto flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {saving ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>) : (<><Check className="h-3.5 w-3.5 text-primary" /> Saved</>)}
            </span>
          </div>
        </header>
      )}

      <button type="button" onClick={() => setTopBarOpen((v) => !v)}
        className="z-20 flex w-full shrink-0 items-center justify-center gap-1.5 border-b border-border/50 bg-background/80 py-1 text-xs font-medium text-muted-foreground backdrop-blur transition hover:bg-muted/50 hover:text-foreground"
        title={topBarOpen ? "Hide toolbar" : "Show toolbar"}>
        {topBarOpen ? (<><ChevronUp className="h-3.5 w-3.5" /> Hide toolbar</>) : (<><ChevronDown className="h-3.5 w-3.5" /> Show toolbar</>)}
      </button>

      <SceneStrip scenes={scenes} activeId={activeScene?.id ?? null} onSelect={setActiveSceneId} onAdd={addScene} onDuplicate={duplicateScene} onDelete={deleteScene} />

      <div className="z-10 flex shrink-0 flex-wrap items-center gap-2 border-b border-border/40 bg-background/80 px-4 py-2 backdrop-blur">
        <span className="mr-1 text-xs font-semibold text-muted-foreground">Scene {activeIndex + 1} / {scenes.length}</span>
        {slots.map((s) => { const Icon = s.icon; return (
          <Button key={s.kind} size="sm" variant="secondary" onClick={() => openAsset(s.kind)}>
            <Icon className="mr-1.5 h-4 w-4" />{s.label}
          </Button>
        );})}
        <Button size="sm" variant="secondary" onClick={addProgressTower}><TowerControl className="mr-1.5 h-4 w-4" /> Progress Bar</Button>
        <Button size="sm" onClick={() => openAsset("effect")}><Layers className="mr-1.5 h-4 w-4" /> Add Effect</Button>
        <div className="mx-1 h-6 w-px bg-border/60" />
        <Button size="sm" variant="ghost" disabled title="Coming soon" className="opacity-60"><HelpCircle className="mr-1.5 h-4 w-4" /> Questions</Button>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant={selected && selected.kind !== "background" ? "secondary" : "ghost"}
            disabled={!selected || selected.kind === "background"} onClick={setCameraTarget}>
            <Camera className="mr-1.5 h-4 w-4" /> Set Camera Target
          </Button>
          <Button size="sm" variant={drawerOpen ? "default" : "secondary"} onClick={() => setDrawerOpen((v) => !v)}>
            <Sliders className="mr-1.5 h-4 w-4" /> Settings
          </Button>
          {!railOpen && (
            <Button size="sm" variant="secondary" onClick={() => setRailOpen(true)}><Layers className="mr-1.5 h-4 w-4" /> Layers</Button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <main ref={stageWrapRef}
          className={stageFull ? "fixed inset-0 z-50 overflow-hidden bg-background" : "relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_center,hsl(var(--muted)/0.35),transparent)]"}>
          <div className="h-full w-full overflow-auto" onPointerDown={onStagePointerDown} onPointerMove={onStagePointerMove} onPointerUp={onStagePointerUp} onWheel={onWheel}>
            <div className={stageFull ? "flex h-full w-full items-center justify-center p-0" : "flex min-h-full w-full items-start justify-center p-4"}>
              <div ref={canvasWrapRef}
                className={stageFull ? "flex h-full w-full items-center justify-center transition-transform" : "w-full max-w-6xl transition-transform"}
                style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: stageFull ? "center center" : "top center" }}>
                <GameCanvas elements={elements} selectedId={selectedId} editable onSelect={setSelectedId} onMove={moveElement}
                  className={stageFull ? "h-full max-h-full w-auto max-w-full" : undefined} />
              </div>
            </div>
          </div>

          <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1 rounded-lg border border-border/50 bg-background/90 p-1 text-xs shadow backdrop-blur">
            {stageFull && (<button className="rounded px-1.5 py-0.5 hover:bg-muted" onClick={enterFullscreen} title="Exit fullscreen">Exit</button>)}
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.1).toFixed(2)))} title="Zoom out"><Minus className="h-4 w-4" /></Button>
            <button className="rounded px-1.5 py-0.5 hover:bg-muted" onClick={resetView} title="Fit">Fit</button>
            <button className="rounded px-1.5 py-0.5 hover:bg-muted" onClick={() => setZoom(1)} title="100%">100%</button>
            <button className="rounded px-1.5 py-0.5 hover:bg-muted" onClick={() => setZoom(2)} title="200%">200%</button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))} title="Zoom in"><Plus className="h-4 w-4" /></Button>
            <span className="w-10 text-center text-muted-foreground">{Math.round(zoom * 100)}%</span>
          </div>
          <p className="pointer-events-none absolute bottom-4 right-4 z-10 rounded bg-background/70 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur">
            Alt-drag to pan · scroll or Ctrl+wheel
          </p>
        </main>

        {railOpen && (
          <EffectsRail elements={elements} selectedId={selectedId} cameraTargetId={activeScene?.cameraTargetId}
            onSelect={setSelectedId} onClose={() => setRailOpen(false)} />
        )}

        {drawerOpen && (
          <aside className="flex h-full w-80 flex-col border-l border-border/50 bg-background/95 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between border-b border-border/50 px-3 py-2.5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Edit item</h2>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDrawerOpen(false)} title="Fold panel">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <SettingsPanel element={selected} onChange={patchElement} onDelete={deleteSelected} onLayer={layer}
                onDuplicate={duplicateSelected} onOpenEnergyPicker={() => openAsset("effect", true)}
                energyRefreshKey={energyRefreshKey} onOpenQuestions={openQuestions} />
            </div>
          </aside>
        )}
      </div>

      <AssetLibraryModal open={assetOpen} onOpenChange={setAssetOpen} kind={activeKind} onKindChange={setActiveKind}
        onPickUploaded={onPickUploaded} onPickUrl={onPickUrl} onPickPreset={onPickPreset} />

      <Dialog open={metaOpen} onOpenChange={(o) => { if (!o && metaTitle.trim() && metaTopic.trim() && metaSubtopic.trim()) setMetaOpen(false); }}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Name this game</DialogTitle>
            <DialogDescription>
              The title, topic and subtopic tell the AI what questions to generate (e.g. "Quadratic Equations" · "Algebra" · "Quadratic Formula").
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Title</Label>
              <Input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} placeholder="Quadratic Equations" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Topic</Label>
              <Input value={metaTopic} onChange={(e) => setMetaTopic(e.target.value)} placeholder="Algebra" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Subtopic</Label>
              <Input value={metaSubtopic} onChange={(e) => setMetaSubtopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && metaTitle.trim() && metaTopic.trim() && metaSubtopic.trim() && saveMeta()}
                placeholder="Quadratic Formula" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveMeta} disabled={!metaTitle.trim() || !metaTopic.trim() || !metaSubtopic.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdventureGameEditor;
