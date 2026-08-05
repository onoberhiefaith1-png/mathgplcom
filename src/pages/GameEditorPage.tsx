import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "@/lib/router-compat";
import RewardConfigPanel, { type RewardDraft } from "@/components/gamebuilder/RewardConfigPanel";
import { useGalleryScrollMemory } from "@/lib/games/galleryScroll";
import {
  captureRewardElementStyle,
  loadClassGalleryReward,
  loadClassGalleryRewards,
  upsertClassGalleryReward,
  type ClassGalleryRewardRow,
} from "@/lib/games/classGalleryRewards";
import { listClassGroups, type AdventureGroup } from "@/lib/adventures/groups";
import { parseAnimateReward, useGalleryAwards } from "@/hooks/useGalleryAwards";

import {
  ArrowLeft,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Crosshair,
  HelpCircle,
  Image,
  Layers,
  Loader2,
  Maximize,
  Minimize,
  Minus,
  Play,
  Plus,
  Radio,
  Sliders,
  TowerControl,
  Trophy,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import GameCanvas from "@/components/gamebuilder/GameCanvas";
import AssetLibraryModal, { type UrlPick } from "@/components/gamebuilder/AssetLibraryModal";
import SettingsPanel from "@/components/gamebuilder/SettingsPanel";

import EffectsRail from "@/components/gamebuilder/EffectsRail";
import VideoBackgroundLayer, { type VideoBackgroundHandle } from "@/components/gamebuilder/VideoBackgroundLayer";
import CheckpointTimeline from "@/components/gamebuilder/CheckpointTimeline";
import NarrationPanel from "@/components/gamebuilder/NarrationPanel";
import SceneStrip from "@/components/gamebuilder/SceneStrip";
import { useLoopRuntime } from "@/lib/games/loopRuntime";
import { useNarrationPlayback } from "@/lib/games/narration";

import { getGame, renameGame, saveGameCanvas, updateGameMeta } from "@/lib/games/games";
import {
  adventureModeOf,
  adventureModeLabel,
  nextBarRole,
  LEARNING_BAR_LABEL,
  TIME_BAR_LABEL,
  type AdventureMode,
  type BarRole,
} from "@/lib/games/types";
import { getOrCreateClassGallery, saveClassGalleryCanvas } from "@/lib/games/classGallery";
import { ensureGameQuestionNotebook } from "@/lib/games/gameQuestions";
import { supabase } from "@/integrations/supabase/client";
import { importUrlAsGameAsset, renderPathOf } from "@/lib/games/assets";
import { detectMediaBackground } from "@/lib/games/removeBackground";
import { getSignedUrl } from "@/lib/games/urls";
import { DEFAULT_PRESET_ID } from "@/lib/games/progressPresets";
import {
  AssetKind,
  CanvasElement,
  GameAssetRow,
  Scene,
  Narration,
  VideoBackground,
  checkpointAt,
  checkpointsOf,

  defaultAnimation,
  makeCheckpoint,
  narrationsOf,
  normalizeCanvas,
  uid,
} from "@/lib/games/types";

const labelForKind = (kind: AssetKind, name?: string) =>
  name || kind.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

interface GameEditorPageProps {
  mode?: "game" | "gallery";
}

const GameEditorPage = ({ mode = "game" }: GameEditorPageProps = {}) => {
  const params = useParams();
  const gameId = mode === "gallery" ? undefined : params.gameId;
  const classId = mode === "gallery" ? params.classId : undefined;
  const isGallery = mode === "gallery";
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
  const [heightUnits, setHeightUnits] = useState(1);
  // ── Video Adventure (video background + Checkpoints) ─────────────
  const [video, setVideo] = useState<VideoBackground | null>(null);
  /** Chosen game mode — decides how the adventure is staged. */
  const [adventureMode, setAdventureMode] = useState<AdventureMode>("static");
  /** Mode being picked inside the meta dialog (applied on Save). */
  const [metaMode, setMetaMode] = useState<AdventureMode>("static");
  const [videoTime, setVideoTime] = useState(0);
  /** Narration clips pinned to timestamps in the background video. */
  const [narrations, setNarrations] = useState<Narration[]>([]);
  const [narrationOpen, setNarrationOpen] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const videoRef = useRef<VideoBackgroundHandle | null>(null);
  const videoModeRef = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [galleryView, setGalleryView] = useState<"edit" | "view">("edit");
  const [activeKind, setActiveKind] = useState<AssetKind>("background");
  const [assetOpen, setAssetOpen] = useState(false);
  const [energyRefreshKey, setEnergyRefreshKey] = useState(0);
  const energyModeRef = useRef(false);
  const [topBarOpen, setTopBarOpen] = useState(false);
  /** Compact chrome: the default toolbar must stay inside ~20% of the height. */
  const cmpBtn = "h-7 gap-1 px-2 text-[11px]";
  const cmpIcon = "h-3.5 w-3.5";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [stageFull, setStageFull] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const loadedRef = useRef(false);
  const stageWrapRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const stageScrollRef = useRef<HTMLDivElement>(null);

  // ── Reward-config overlay (gallery mode only) ───────────────────
  const [searchParams, setSearchParams] = useSearchParams();
  const configureRewardParam = isGallery ? searchParams.get("configureReward") : null;
  const [rewardGameId, rewardElementId] = useMemo(() => {
    if (!configureRewardParam) return [null, null] as [string | null, string | null];
    const [g, e] = configureRewardParam.split(":");
    return [g || null, e || null];
  }, [configureRewardParam]);
  const isConfiguringReward = Boolean(rewardGameId && rewardElementId);
  const [rewardSource, setRewardSource] = useState<CanvasElement | null>(null);
  const [rewardDraft, setRewardDraft] = useState<RewardDraft>({
    startX: 0.5, startY: 0.9, endX: 0.5, endY: 0.15,
    scale: 0.15, rotation: 0, opacity: 1, durationMs: 30000,
  });
  const [rewardStartSet, setRewardStartSet] = useState(false);
  const [rewardEndSet, setRewardEndSet] = useState(false);
  // Where the on-canvas draft reward currently sits (x,y in [0..1]).
  const [rewardPos, setRewardPos] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.9 });
  const [rewardPreviewing, setRewardPreviewing] = useState(false);
  const [rewardSaving, setRewardSaving] = useState(false);
  const [pendingRewards, setPendingRewards] = useState<ClassGalleryRewardRow[]>([]);
  const rewardPreviewFrameRef = useRef<number | null>(null);
  const rewardCameraFollowingRef = useRef(false);
  const suppressPinnedScrollRef = useRef(false);
  const DRAFT_REWARD_ID = "__reward_draft__";
  const PENDING_PREFIX = "__reward_pending_";

  // ── Group tabs (gallery mode) — one shared layout, per-group rewards ──
  const [galleryGroups, setGalleryGroups] = useState<AdventureGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  useEffect(() => {
    if (!isGallery || !classId) return;
    let cancelled = false;
    (async () => {
      try {
        const gs = await listClassGroups(classId);
        if (!cancelled) setGalleryGroups(gs);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { cancelled = true; };
  }, [isGallery, classId]);

  const animateReward = useMemo(
    () => (isGallery ? parseAnimateReward(searchParams.get("animateReward")) : null),
    [isGallery, searchParams],
  );
  useEffect(() => {
    const g = searchParams.get("group");
    if (g) setActiveGroupId(g);
  }, [searchParams]);

  const galleryAwards = useGalleryAwards({
    classId: isGallery ? classId : null,
    groupId: activeGroupId,
    animate: animateReward,
  });



  useEffect(() => {
    if (isGallery) {
      if (!classId) return;
      (async () => {
        try {
          const { data: cls } = await supabase
            .from("classes")
            .select("name")
            .eq("id", classId)
            .maybeSingle();
          const gallery = await getOrCreateClassGallery(classId);
          const canvas = normalizeCanvas(gallery.canvas);
          setTitle(`${(cls as { name?: string } | null)?.name ?? "Class"} Gallery`);
          setTopic("Gallery");
          setSubtopic("Gallery");
          setScenes(canvas.scenes);
          setActiveSceneId(canvas.activeSceneId ?? canvas.scenes[0]?.id ?? null);
          setHeightUnits(Math.max(1, Math.floor(canvas.heightUnits ?? 1)));
          setVideo(canvas.video ?? null);
          setNarrations(narrationsOf(canvas));
          setAdventureMode(adventureModeOf(canvas));
          loadedRef.current = true;
        } catch (e) {
          console.error(e);
          toast({ title: "Could not load gallery", variant: "destructive" });
          navigate(`/teaching-hub/classes/${classId}`);
        } finally {
          setLoading(false);
        }
      })();
      return;
    }
    if (!gameId) return;
    getGame(gameId)
      .then((g) => {
        setTitle(g.title);
        setSubtopic(g.subtopic ?? "");
        setTopic(g.topic ?? "");
        const canvas = normalizeCanvas(g.canvas);
        setScenes(canvas.scenes);
        setActiveSceneId(canvas.activeSceneId ?? canvas.scenes[0]?.id ?? null);
        setHeightUnits(Math.max(1, Math.floor(canvas.heightUnits ?? 1)));
        setVideo(canvas.video ?? null);
        setNarrations(narrationsOf(canvas));
        setAdventureMode(adventureModeOf(canvas));
        setMetaMode(adventureModeOf(canvas));
        loadedRef.current = true;
        // Require Title + Topic + Subtopic so AI questions have context.
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
  }, [gameId, classId, isGallery]);

  // Debounced autosave.
  useEffect(() => {
    if (!loadedRef.current) return;
    if (isGallery) {
      if (!classId) return;
      setSaving(true);
      const t = setTimeout(async () => {
        try {
          await saveClassGalleryCanvas(classId, { mode: adventureMode, scenes, activeSceneId, heightUnits, video, narrations });
        } catch (e) {
          console.error(e);
        } finally {
          setSaving(false);
        }
      }, 700);
      return () => clearTimeout(t);
    }
    if (!gameId) return;
    setSaving(true);
    const t = setTimeout(async () => {
      try {
        await saveGameCanvas(gameId, { mode: adventureMode, scenes, activeSceneId, heightUnits, video, narrations });
      } catch (e) {
        console.error(e);
      } finally {
        setSaving(false);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [scenes, activeSceneId, heightUnits, video, narrations, adventureMode, gameId, classId, isGallery]);

  const activeScene = useMemo(
    () => scenes.find((s) => s.id === activeSceneId) ?? scenes[0] ?? null,
    [scenes, activeSceneId],
  );
  const sceneElements = activeScene?.elements ?? [];
  /** Every stage's elements — the preview picks the current loop's own set. */
  const allSceneElements = useMemo(
    () => scenes.flatMap((s) => s.elements ?? []),
    [scenes],
  );

  const activeIndex = scenes.findIndex((s) => s.id === activeScene?.id);

  // ── Load reward source + existing config for reward-config mode ─
  useEffect(() => {
    if (!isConfiguringReward || !rewardGameId || !rewardElementId || !classId) return;
    let cancelled = false;
    (async () => {
      try {
        const g = await getGame(rewardGameId);
        const canvas = normalizeCanvas(g.canvas);
        const src = canvas.scenes.flatMap((s) => s.elements).find((el) => el.id === rewardElementId);
        if (!src) throw new Error("reward element not found in source game");
        if (cancelled) return;
        setRewardSource(src);
        const existing = await loadClassGalleryReward(classId, rewardGameId, rewardElementId);
        if (cancelled) return;
        if (existing) {
          setRewardDraft({
            startX: Number(existing.start_x), startY: Number(existing.start_y),
            endX: Number(existing.end_x), endY: Number(existing.end_y),
            scale: Number(existing.scale), rotation: Number(existing.rotation),
            opacity: Number(existing.opacity), durationMs: Number(existing.duration_ms),
          });
          setRewardPos({ x: Number(existing.end_x), y: Number(existing.end_y) });
          setRewardStartSet(true);
          setRewardEndSet(true);
        } else {
          // Spawn at whatever y the teacher is currently scrolled to (sensor
          // position). Wait a couple of frames so gallery-scroll-memory has
          // restored scrollTop before we sample it.
          const sampleSensorY = (): number => {
            const scroller = stageScrollRef.current;
            const canvas = canvasWrapRef.current;
            if (!scroller || !canvas || canvas.offsetHeight <= 0) return 0.5;
            const centerY = scroller.scrollTop + scroller.clientHeight / 2;
            const y = (centerY - canvas.offsetTop) / canvas.offsetHeight;
            return Math.min(0.98, Math.max(0.02, y));
          };
          const seed = (y0: number) => {
            setRewardDraft((d) => ({
              ...d,
              scale: src.scale ?? 0.15,
              startX: 0.5,
              startY: y0,
            }));
            setRewardPos({ x: 0.5, y: y0 });
          };
          // First sample now; re-seed after two frames + a short delay so
          // restored scroll position is reflected.
          seed(sampleSensorY());
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (cancelled) return;
              seed(sampleSensorY());
              setTimeout(() => {
                if (cancelled) return;
                seed(sampleSensorY());
              }, 120);
            });
          });
          setRewardStartSet(false);
          setRewardEndSet(false);
        }
        setSelectedId(DRAFT_REWARD_ID);
        setPinnedId(DRAFT_REWARD_ID);
      } catch (e) {
        console.error(e);
        toast({ title: "Could not load reward", variant: "destructive" });
        navigate(`/teaching-hub/classes/${classId}/gallery`);
      }
    })();
    return () => { cancelled = true; };
  }, [isConfiguringReward, rewardGameId, rewardElementId, classId, navigate, toast]);

  // Load previously-placed rewards (dimmed reference in Edit mode).
  useEffect(() => {
    if (!isGallery || !classId) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await loadClassGalleryRewards(classId);
        if (!cancelled) setPendingRewards(rows);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { cancelled = true; };
  }, [isGallery, classId, isConfiguringReward]);

  // Build the draft overlay element from the source reward + current draft.
  const draftRewardElement: CanvasElement | null = useMemo(() => {
    if (!isConfiguringReward || !rewardSource) return null;
    return {
      ...rewardSource,
      id: DRAFT_REWARD_ID,
      x: rewardPos.x,
      y: rewardPos.y,
      scale: rewardDraft.scale,
      rotation: rewardDraft.rotation,
      opacity: rewardDraft.opacity,
      z: 999,
      animation: { ...rewardSource.animation, type: "none" },
    };
  }, [isConfiguringReward, rewardSource, rewardPos, rewardDraft]);

  // Pending (already-saved) rewards for other games in this class — shown at
  // their end position, dimmed, non-interactive, for spatial reference.
  const pendingRewardElements: CanvasElement[] = useMemo(() => {
    if (!isGallery || isConfiguringReward) return [];
    return pendingRewards.map<CanvasElement>((r, i) => ({
      id: `${PENDING_PREFIX}${r.id}`,
      kind: "reward",
      assetId: r.asset_id ?? "",
      mediaType: r.media_type,
      storagePath: r.storage_path,
      source: r.source,
      x: Number(r.end_x),
      y: Number(r.end_y),
      scale: Number(r.scale),
      z: 900 + i,
      rotation: Number(r.rotation),
      opacity: Math.min(0.55, Number(r.opacity) * 0.6),
      animation: { type: "none", amplitude: 0, speed: 1, loop: false },
      blend: "normal",
      bgRemoval: "none",
      label: "Pending reward",
    }));
  }, [isGallery, isConfiguringReward, pendingRewards]);

  const elements: CanvasElement[] = useMemo(() => {
    const earned = isGallery && !isConfiguringReward ? galleryAwards.elements : [];
    const base = [...sceneElements, ...earned, ...pendingRewardElements];
    return draftRewardElement ? [...base, draftRewardElement] : base;
  }, [sceneElements, pendingRewardElements, draftRewardElement, isGallery, isConfiguringReward, galleryAwards.elements]);




  const selected = useMemo(
    () => elements.find((e) => e.id === selectedId) ?? null,
    [elements, selectedId],
  );

  useEffect(() => {
    if (selectedId) setDrawerOpen(true);
  }, [selectedId]);

  // Deselect when switching scenes.
  useEffect(() => {
    setSelectedId(null);
  }, [activeSceneId]);

  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  /**
   * Video Adventure: a Learning Point behaves like a room. Editing while the
   * playhead sits outside the loop would drop the object into an invisible
   * room, so we snap the playhead back inside first (assigned below).
   */
  const ensureInsideLoopRef = useRef<() => void>(() => {});

  /** Mutate the active scene's elements. */
  const setElements = useCallback(
    (updater: (els: CanvasElement[]) => CanvasElement[]) => {
      ensureInsideLoopRef.current();
      setScenes((prev) =>
        prev.map((s) =>
          s.id === (activeSceneId ?? prev[0]?.id)
            ? { ...s, elements: updater(s.elements) }
            : s,
        ),
      );
    },
    [activeSceneId],
  );


  const patchActiveScene = useCallback(
    (patch: Partial<Scene>) => {
      setScenes((prev) =>
        prev.map((s) => (s.id === (activeSceneId ?? prev[0]?.id) ? { ...s, ...patch } : s)),
      );
    },
    [activeSceneId],
  );

  // ── Scene strip (static Adventure: one stage = one scene) ───────
  const newSceneId = () =>
    `scene-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const addScene = useCallback(() => {
    const id = newSceneId();
    setScenes((prev) => [
      ...prev,
      { id, title: `Scene ${prev.length + 1}`, tag: "", elements: [] },
    ]);
    setActiveSceneId(id);
  }, []);

  const duplicateScene = useCallback((sceneId: string) => {
    const id = newSceneId();
    setScenes((prev) => {
      const i = prev.findIndex((s) => s.id === sceneId);
      if (i < 0) return prev;
      const src = prev[i];
      const copy: Scene = {
        ...src,
        id,
        elements: src.elements.map((el) => ({
          ...el,
          id: `${el.kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        })),
      };
      return [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)];
    });
    setActiveSceneId(id);
  }, []);

  const deleteScene = useCallback((sceneId: string) => {
    setScenes((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((s) => s.id !== sceneId);
      setActiveSceneId((cur) => (cur === sceneId ? next[0]?.id ?? null : cur));
      return next;
    });
  }, []);

  // ── Canvas operations ───────────────────────────────────────────
  /**
   * Grow the canvas by one 16:9 section vertically. Existing elements' y
   * values are rescaled so they stay put visually while the total height
   * grows.
   */
  const galleryScroll = useGalleryScrollMemory(isGallery ? classId : undefined);

  // Reward-link mode mounts after the shared Gallery canvas and draft reward are
  // loaded, so give scroll memory another chance once that mode is ready.
  useEffect(() => {
    if (!isGallery || !isConfiguringReward || loading || !rewardSource) return;
    suppressPinnedScrollRef.current = true;
    galleryScroll.retryRestore();
    const restoreTimer = window.setTimeout(() => galleryScroll.retryRestore(), 80);
    const releaseTimer = window.setTimeout(() => {
      suppressPinnedScrollRef.current = false;
    }, 180);
    return () => {
      window.clearTimeout(restoreTimer);
      window.clearTimeout(releaseTimer);
      suppressPinnedScrollRef.current = false;
    };
  }, [isGallery, isConfiguringReward, loading, rewardSource, heightUnits, galleryScroll.retryRestore]);

  const extendCanvas = useCallback(() => {
    setHeightUnits((h) => {
      const next = h + 1;
      setScenes((prev) =>
        prev.map((s) => ({
          ...s,
          elements: s.elements.map((el) => ({
            ...el,
            y: (el.y * h + 1) / next,
          })),
        })),
      );
      return next;
    });
    // New space is added at the top — jump to the bottom once so existing
    // content stays in view. Overrides the persisted position for this action.
    galleryScroll.markJumpToBottom();
  }, [galleryScroll]);

  /** Shrink the canvas by one section (min 1). Removes the top section. */
  const shrinkCanvas = useCallback(() => {
    setHeightUnits((h) => {
      if (h <= 1) return h;
      const next = h - 1;
      setScenes((prev) =>
        prev.map((s) => ({
          ...s,
          elements: s.elements.map((el) => ({
            ...el,
            y: Math.min(1, Math.max(0, (el.y * h - 1) / next)),
          })),
        })),
      );
      return next;
    });
  }, []);








  // ── Element operations ──────────────────────────────────────────
  const placeReward = useCallback(
    (opts: {
      kind: AssetKind;
      assetId: string;
      mediaType: CanvasElement["mediaType"];
      storagePath: string;
      source: "storage" | "url";
      name?: string;
    }) => {
      const { kind } = opts;
      // Reward / progress / effect videos get their background keyed out so they
      // blend into the scene. Backgrounds and images are left as-is (images are
      // already stored as transparent PNGs).
      const keyable = kind === "reward" || kind === "progress_bar" || kind === "effect";
      const chroma = keyable && opts.mediaType === "video";
      const base: CanvasElement = {
        id: uid(),
        kind,
        assetId: opts.assetId,
        mediaType: opts.mediaType,
        storagePath: opts.storagePath,
        source: opts.source,
        label: labelForKind(kind, opts.name),
        x: 0.5,
        y: 0.5,
        scale: kind === "progress_bar" ? 0.22 : 0.28,
        z: 1,
        rotation: 0,
        opacity: 1,
        blend: "normal",
        bgRemoval: chroma ? "chroma" : "none",
        keyTolerance: chroma ? 0.12 : undefined,
        animation: defaultAnimation(),
        ...(kind === "progress_bar"
          ? {
              progress: {
                segments: 10,
                presetId: DEFAULT_PRESET_ID,
                totalMarks: 400,
                currentMarks: 0,
                fill: 0,
                glow: 0.5,
                effectScale: 1,
                fillStyle: "plain",
              },
            }
          : {}),
      };

      setElements((els) => {
        if (kind === "background") {
          // Backgrounds are freely movable layers now — never replace or lock.
          // Spawn at the current scroll viewport center so the new background
          // appears where the teacher is currently looking.
          const scroller = stageScrollRef.current;
          let y = 0.5;
          if (scroller && scroller.scrollHeight > scroller.clientHeight) {
            const viewportCenter = scroller.scrollTop + scroller.clientHeight / 2;
            y = Math.min(1, Math.max(0, viewportCenter / scroller.scrollHeight));
          }
          const bgCount = els.filter((e) => e.kind === "background").length;
          return [
            ...els,
            {
              ...base,
              x: 0.5,
              y,
              scale: 1,
              // Stack subsequent backgrounds slightly above earlier ones.
              z: bgCount,
            },
          ];
        }
        const maxZ = els.reduce((m, e) => Math.max(m, e.z), 0);
        return [...els, { ...base, z: maxZ + 1 }];
      });
      if (kind !== "background") setSelectedId(base.id);

      // Auto-detect the background color to key out (async, patched in when ready).
      if (chroma) {
        (async () => {
          try {
            const url =
              opts.source === "url" ? opts.storagePath : await getSignedUrl(opts.storagePath);
            if (!url) return;
            const det = await detectMediaBackground(url, "video");
            setScenes((prev) =>
              prev.map((s) => ({
                ...s,
                elements: s.elements.map((e) =>
                  e.id === base.id
                    ? det.keyable
                      ? { ...e, keyColor: det.color, bgRemoval: "chroma" }
                      : { ...e, bgRemoval: "none" }
                    : e,
                ),
              })),
            );
          } catch (err) {
            console.error("chroma detection failed", err);
          }
        })();
      }
    },
    [setElements],
  );

  // Drop a built-in cinematic progress tower directly onto the stage (no upload).
  //
  // Every Scene / Learning Point owns exactly two bars: the system-owned Time
  // Progress Bar and the Learning Progress Bar that carries the questions.
  const addProgressTower = useCallback(() => {
    const role = nextBarRole(elements);
    if (!role) {
      toast({
        title: "Both Progress Bars already exist",
        description: `Each Scene has one ${TIME_BAR_LABEL} and one ${LEARNING_BAR_LABEL}. Select one to edit it.`,
      });
      return;
    }
    const base: CanvasElement = {
      id: uid(),
      kind: "progress_bar",
      assetId: `preset:${DEFAULT_PRESET_ID}`,
      mediaType: "image",
      storagePath: "",
      source: "url",
      label: role === "time" ? TIME_BAR_LABEL : LEARNING_BAR_LABEL,
      x: role === "time" ? 0.08 : 0.85,
      y: 0.5,
      scale: 0.18,
      z: 1,
      rotation: 0,
      opacity: 1,
      blend: "normal",
      bgRemoval: "none",
      animation: defaultAnimation(),
      progress: {
        role,
        ...(role === "time" ? { timeDurationSeconds: 300 } : {}),
        segments: 10,
        presetId: DEFAULT_PRESET_ID,
        totalMarks: 400,
        currentMarks: 0,
        fill: 0,
        glow: 0.5,
        effectScale: 1,
        fillStyle: "plain",
      },
    };
    setElements((els) => {
      const maxZ = els.reduce((m, e) => Math.max(m, e.z), 0);
      return [...els, { ...base, z: maxZ + 1 }];
    });
    setSelectedId(base.id);
  }, [elements, setElements, toast]);



  /** Attach an energy effect to the currently selected progress tower (all slots). */
  const applyEnergyToSelected = useCallback(
    (opts: {
      assetId: string;
      storagePath: string;
      mediaType: CanvasElement["mediaType"];
      source: "storage" | "url";
    }) => {
      const sel = elements.find((e) => e.id === selectedIdRef.current);
      if (!sel || sel.kind !== "progress_bar" || !sel.progress) return false;
      setElements((els) =>
        els.map((e) =>
          e.id === sel.id && e.progress
            ? {
                ...e,
                progress: {
                  ...e.progress,
                  fillStyle: "effect",
                  effectAssetId: opts.assetId,
                  effectStoragePath: opts.storagePath,
                  effectMediaType: opts.mediaType,
                  effectSource: opts.source,
                },
              }
            : e,
        ),
      );
      return true;
    },
    [elements, setElements],
  );

  // Pick a built-in MathGPL progress-bar design from the Assets panel: retarget
  // the selected progress tower, or drop a fresh one using that preset.
  const onPickPreset = useCallback(
    (presetId: string) => {
      const sel = elements.find((e) => e.id === selectedIdRef.current);
      if (sel && sel.kind === "progress_bar" && sel.progress) {
        setElements((els) =>
          els.map((e) =>
            e.id === sel.id && e.progress
              ? { ...e, assetId: `preset:${presetId}`, progress: { ...e.progress, presetId } }
              : e,
          ),
        );
        return;
      }
      // No bar selected — only create one when a slot is still free.
      const role: BarRole | null = nextBarRole(elements);
      if (!role) {
        toast({
          title: "Both Progress Bars already exist",
          description: "Select a bar on the stage to change its design.",
        });
        return;
      }
      const base: CanvasElement = {
        id: uid(),
        kind: "progress_bar",
        assetId: `preset:${presetId}`,
        mediaType: "image",
        storagePath: "",
        source: "url",
        label: role === "time" ? TIME_BAR_LABEL : LEARNING_BAR_LABEL,
        x: role === "time" ? 0.08 : 0.85,
        y: 0.5,
        scale: 0.18,
        z: 1,
        rotation: 0,
        opacity: 1,
        blend: "normal",
        bgRemoval: "none",
        animation: defaultAnimation(),
        progress: {
          role,
          ...(role === "time" ? { timeDurationSeconds: 300 } : {}),
          segments: 10,
          presetId,
          totalMarks: 400,
          currentMarks: 0,
          fill: 0,
          glow: 0.5,
          effectScale: 1,
          fillStyle: "plain",
        },
      };
      setElements((els) => {
        const maxZ = els.reduce((m, e) => Math.max(m, e.z), 0);
        return [...els, { ...base, z: maxZ + 1 }];
      });
      setSelectedId(base.id);
    },
    [elements, setElements, toast],
  );

  /** Use a picked media file as the scene's video background. */
  const applyVideoBackground = useCallback(
    (v: VideoBackground) => {
      videoModeRef.current = false;
      setVideo({ muted: true, ...v });
      setHeightUnits(1);
      setVideoTime(0);
      setVideoPlaying(false);
      toast({
        title: "Video background set",
        description: "Play the video, then Set Start / Set End to add a Checkpoint.",
      });
    },
    [toast],
  );

  const onPickUploaded = useCallback(
    (asset: GameAssetRow) => {
      if (videoModeRef.current) {
        if (asset.media_type !== "video") {
          toast({ title: "Pick a video file", variant: "destructive" });
          return;
        }
        applyVideoBackground({ path: renderPathOf(asset), source: "storage", title: asset.title });
        return;
      }
      const sel = elements.find((e) => e.id === selectedIdRef.current);
      if (asset.kind === "effect" && sel?.kind === "progress_bar" && sel.progress) {
        // Store energy on the selected progress column instead of placing it.
        applyEnergyToSelected({
          assetId: asset.id,
          storagePath: renderPathOf(asset),
          mediaType: asset.media_type,
          source: "storage",
        });
        setEnergyRefreshKey((k) => k + 1);
        return;
      }
      placeReward({
        kind: asset.kind,
        assetId: asset.id,
        mediaType: asset.media_type,
        storagePath: renderPathOf(asset),
        source: "storage",
        name: asset.title,
      });
    },
    [placeReward, applyEnergyToSelected, elements, applyVideoBackground, toast],
  );

  const onPickUrl = useCallback(
    async (pick: UrlPick) => {
      if (videoModeRef.current) {
        if (pick.mediaType !== "video") {
          toast({ title: "Pick a video file", variant: "destructive" });
          return;
        }
        applyVideoBackground({ path: pick.src, source: "url", title: pick.name });
        return;
      }
      // Energy mode: import the library asset INTO this game's effects and
      // attach it — never drop it straight onto the scene.
      if (energyModeRef.current) {
        try {
          const asset = await importUrlAsGameAsset(pick.src, "effect", pick.name);
          applyEnergyToSelected({
            assetId: asset.id,
            storagePath: renderPathOf(asset),
            mediaType: asset.media_type,
            source: "storage",
          });
          setEnergyRefreshKey((k) => k + 1);
          toast({ title: "Energy added", description: "Saved to this game's effects." });
        } catch (e) {
          console.error(e);
          toast({ title: "Could not add energy", variant: "destructive" });
        }
        return;
      }
      placeReward({
        kind: activeKind,
        assetId: pick.src,
        mediaType: pick.mediaType,
        storagePath: pick.src,
        source: "url",
        name: pick.name,
      });
    },
    [activeKind, placeReward, applyEnergyToSelected, toast, applyVideoBackground],
  );

  const openAsset = (kind: AssetKind, forEnergy = false) => {
    energyModeRef.current = forEnergy;
    videoModeRef.current = false;
    setActiveKind(kind);
    setAssetOpen(true);
  };

  /** Pick a video to use as the moving background. */
  const openVideoPicker = () => {
    energyModeRef.current = false;
    videoModeRef.current = true;
    setActiveKind("background");
    setAssetOpen(true);
  };

  // ── Checkpoints (loop regions inside the background video) ───────
  const checkpoints = useMemo(() => checkpointsOf({ scenes, video }), [scenes, video]);

  // ── Preview runtime (manual Learning Point control) ──────────────
  const seekVideo = useCallback((t: number) => {
    videoRef.current?.seek(t);
    setVideoTime(t);
  }, []);
  const preview = useLoopRuntime(checkpoints, seekVideo);
  // Narration fires only while the adventure is running (Preview), never while
  // the teacher scrubs the authoring timeline. Every Start Preview is a brand
  // new run (`preview.runId`), so Play Once clips speak again — Play Once /
  // Repeat only shape behaviour *inside* one run.
  const narrationRuntime = useNarrationPlayback(narrations, preview.active, preview.runId);

  const previewFinalLoop =
    preview.activeLoopId != null &&
    checkpoints.length > 0 &&
    checkpoints[checkpoints.length - 1]?.id === preview.activeLoopId;

  /**
   * Loop-based object visibility. The Loop is a room: the loop under the blue
   * playhead is the only one whose objects exist. Outside every loop the
   * workspace shows nothing but the background video.
   */
  const playheadLoop = useMemo(
    () => (video ? checkpointAt(checkpoints, videoTime) : null),
    [video, checkpoints, videoTime],
  );
  const insideActiveLoop = !video || (playheadLoop != null && playheadLoop.id === activeSceneId);

  // Entering a loop selects it; leaving every loop drops the selection so no
  // stale settings panel stays open on a hidden object.
  useEffect(() => {
    if (!video || preview.active) return;
    if (playheadLoop) {
      if (playheadLoop.id !== activeSceneId) setActiveSceneId(playheadLoop.id);
    } else {
      setSelectedId(null);
      // Developer-only signal; never rendered on the canvas.
      console.debug("[adventure] playhead outside every Learning Point — objects hidden");
    }
  }, [video, preview.active, playheadLoop, activeSceneId]);



  useEffect(() => {
    ensureInsideLoopRef.current = () => {
      if (!video || insideActiveLoop) return;
      const target = checkpoints.find((c) => c.id === activeSceneId) ?? checkpoints[0];
      if (!target || target.loopStart == null) return;
      const t = target.loopStart + 0.05;
      videoRef.current?.seek(t);
      setVideoTime(t);
      if (target.id !== activeSceneId) setActiveSceneId(target.id);
    };
  }, [video, insideActiveLoop, checkpoints, activeSceneId]);



  const addCheckpoint = useCallback(
    (start: number, end: number) => {
      setScenes((prev) => {
        const cp = makeCheckpoint(prev.length, start, end);
        setActiveSceneId(cp.id);
        return [...prev, cp];
      });
      setVideoPlaying(false);
    },
    [],
  );

  const patchCheckpoint = useCallback((id: string, patch: Partial<Scene>) => {
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const deleteCheckpoint = useCallback((id: string) => {
    setScenes((prev) => {
      const next = prev.filter((s) => s.id !== id);
      const fallback = next[0]?.id ?? null;
      setActiveSceneId((cur) => (cur === id ? fallback : cur));
      return next;
    });
  }, []);

  const removeVideoBackground = useCallback(() => {
    setVideo(null);
    setVideoPlaying(false);
  }, []);

  // In video mode always edit inside a Checkpoint, never the legacy base scene.
  useEffect(() => {
    if (!video || checkpoints.length === 0) return;
    if (!checkpoints.some((c) => c.id === activeSceneId)) setActiveSceneId(checkpoints[0].id);
  }, [video, checkpoints, activeSceneId]);

  /**
   * Video Adventure gate: until a first Loop exists the teacher can only
   * upload a video and mark Set Start / Set End — no background, reward,
   * progress bar, effects or questions.
   */
  const videoGate = adventureMode === "video" && (!video || checkpoints.length === 0);



  const patchElement = useCallback(
    (patch: Partial<CanvasElement>) => {
      if (!selectedId) return;
      setElements((els) => els.map((e) => (e.id === selectedId ? { ...e, ...patch } : e)));
    },
    [selectedId, setElements],
  );

  const moveElement = useCallback(
    (id: string, x: number, y: number) => {
      const snap = (v: number) => (Math.abs(v - 0.5) < 0.02 ? 0.5 : v);
      if (id === DRAFT_REWARD_ID) {
        // While previewing, ignore drag; the animation drives position.
        if (rewardPreviewing) return;
        setRewardPos({ x: snap(x), y: snap(y) });
        return;
      }
      if (id.startsWith(PENDING_PREFIX)) return; // non-interactive
      setElements((els) => els.map((e) => (e.id === id ? { ...e, x: snap(x), y: snap(y) } : e)));
    },
    [setElements, rewardPreviewing],
  );

  // Click cycle: nothing → selected → pinned-to-scroll → unselected.
  // Selecting a different element clears any existing pin.
  const handleSelect = useCallback(
    (id: string | null) => {
      // In reward-config mode only the draft reward is interactive, and its
      // highlight toggles on repeat click.
      if (isConfiguringReward) {
        if (id === null || id !== DRAFT_REWARD_ID) {
          setSelectedId(null);
          setPinnedId(null);
          return;
        }
        if (selectedId === DRAFT_REWARD_ID) {
          // second click on the draft reward → unhighlight (and unpin)
          setSelectedId(null);
          setPinnedId(null);
        } else {
          setSelectedId(DRAFT_REWARD_ID);
          setPinnedId(DRAFT_REWARD_ID);
        }
        return;
      }
      if (id && id.startsWith(PENDING_PREFIX)) return;
      if (id === null) {
        setSelectedId(null);
        setPinnedId(null);
        return;
      }
      if (id === pinnedId) {
        // third click on the same element → release
        setPinnedId(null);
        setSelectedId(null);
        return;
      }
      if (id === selectedId) {
        // second click on the already-selected element → pin it
        setPinnedId(id);
        return;
      }
      // new selection → clear any pin
      setSelectedId(id);
      setPinnedId(null);
    },
    [selectedId, pinnedId, isConfiguringReward],
  );

  // ── Reward-config handlers ──────────────────────────────────────
  const [rewardArmed, setRewardArmed] = useState<"start" | "end" | null>(null);
  const recordRewardPoint = useCallback((mode: "start" | "end") => {
    setRewardDraft((d) =>
      mode === "start"
        ? { ...d, startX: rewardPos.x, startY: rewardPos.y }
        : { ...d, endX: rewardPos.x, endY: rewardPos.y },
    );
    if (mode === "start") setRewardStartSet(true);
    else setRewardEndSet(true);
    setRewardArmed(mode);
  }, [rewardPos]);

  // Enter-key capture for the armed Start/End slot while configuring.
  useEffect(() => {
    if (!isConfiguringReward) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      const t = document.activeElement as HTMLElement | null;
      if (t) {
        const tag = t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable) return;
      }
      e.preventDefault();
      const next: "start" | "end" =
        rewardArmed ?? (!rewardStartSet ? "start" : !rewardEndSet ? "end" : "end");
      recordRewardPoint(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isConfiguringReward, rewardArmed, rewardStartSet, rewardEndSet, recordRewardPoint]);

  const scrollToRewardPoint = useCallback((y: number) => {
    const scroller = stageScrollRef.current;
    const canvas = canvasWrapRef.current;
    if (!scroller || !canvas) return;
    const maxScroll = scroller.scrollHeight - scroller.clientHeight;
    if (maxScroll <= 0) return;
    const targetTop = canvas.offsetTop + y * canvas.offsetHeight - scroller.clientHeight * 0.45;
    scroller.scrollTop = Math.min(maxScroll, Math.max(0, targetTop));
  }, []);

  const previewReward = useCallback(() => {
    if (rewardPreviewing) return;
    const dur = Math.max(500, rewardDraft.durationMs);
    if (rewardPreviewFrameRef.current != null) cancelAnimationFrame(rewardPreviewFrameRef.current);
    if (!stageFull) {
      setStageFull(true);
      stageWrapRef.current?.requestFullscreen?.().catch(() => {});
    }
    rewardCameraFollowingRef.current = true;
    setRewardPreviewing(true);
    setRewardPos({ x: rewardDraft.startX, y: rewardDraft.startY });
    scrollToRewardPoint(rewardDraft.startY);
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      // ease-in-out cubic
      const k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const x = rewardDraft.startX + (rewardDraft.endX - rewardDraft.startX) * k;
      const y = rewardDraft.startY + (rewardDraft.endY - rewardDraft.startY) * k;
      setRewardPos({ x, y });
      scrollToRewardPoint(y);
      if (t < 1) {
        rewardPreviewFrameRef.current = requestAnimationFrame(step);
      } else {
        rewardPreviewFrameRef.current = null;
        rewardCameraFollowingRef.current = false;
        setRewardPos({ x: rewardDraft.endX, y: rewardDraft.endY });
        scrollToRewardPoint(rewardDraft.endY);
        setRewardPreviewing(false);
      }
    };
    rewardPreviewFrameRef.current = requestAnimationFrame(step);
  }, [rewardPreviewing, rewardDraft, scrollToRewardPoint, stageFull]);

  useEffect(() => {
    return () => {
      rewardCameraFollowingRef.current = false;
      if (rewardPreviewFrameRef.current != null) cancelAnimationFrame(rewardPreviewFrameRef.current);
    };
  }, []);

  const saveReward = useCallback(async () => {
    if (!classId || !rewardGameId || !rewardElementId || !rewardSource) return;
    setRewardSaving(true);
    try {
      await upsertClassGalleryReward({
        class_id: classId,
        game_id: rewardGameId,
        reward_element_id: rewardElementId,
        asset_id: rewardSource.assetId || null,
        storage_path: rewardSource.storagePath,
        media_type: rewardSource.mediaType,
        source: rewardSource.source ?? "storage",
        // Move the configured object, not the uploaded file: the reward keeps
        // its Adventure look (transparency, blend, tint, lean) in transit.
        element_style: captureRewardElementStyle(rewardSource),
        start_x: rewardDraft.startX, start_y: rewardDraft.startY,
        end_x: rewardDraft.endX, end_y: rewardDraft.endY,
        scale: rewardDraft.scale,
        rotation: rewardDraft.rotation,
        opacity: rewardDraft.opacity,
        duration_ms: rewardDraft.durationMs,
      });
      toast({ title: "Reward placement saved" });
      navigate(`/teaching-hub/classes/${classId}/adventures/${rewardGameId}/dashboard`);
    } catch (e) {
      console.error(e);
      toast({ title: "Could not save reward", variant: "destructive" });
    } finally {
      setRewardSaving(false);
    }
  }, [classId, rewardGameId, rewardElementId, rewardSource, rewardDraft, navigate, toast]);

  const cancelReward = useCallback(() => {
    if (!classId) return;
    navigate(rewardGameId
      ? `/teaching-hub/classes/${classId}/adventures/${rewardGameId}/dashboard`
      : `/teaching-hub/classes/${classId}/gallery`);
  }, [classId, rewardGameId, navigate]);




  // Pin-to-scroll: while an element is pinned, moving the stage's scrollbar
  // drags the element up/down along with it.
  useEffect(() => {
    const scroller = stageScrollRef.current;
    if (!scroller || !pinnedId) return;
    let lastTop = scroller.scrollTop;
    const onScroll = () => {
      const delta = scroller.scrollTop - lastTop;
      lastTop = scroller.scrollTop;
      if (!delta || rewardCameraFollowingRef.current || suppressPinnedScrollRef.current) return;
      const totalPx = scroller.scrollHeight;
      if (totalPx <= 0) return;
      const dyNorm = delta / totalPx;
      if (isConfiguringReward && pinnedId === DRAFT_REWARD_ID) {
        const canvasHeight = canvasWrapRef.current?.offsetHeight ?? totalPx;
        const sameDirectionDyNorm = canvasHeight > 0 ? (delta * 2) / canvasHeight : dyNorm;
        setRewardPos((p) => ({
          ...p,
          y: Math.min(1, Math.max(0, p.y + sameDirectionDyNorm)),
        }));
        return;
      }
      setElements((els) =>
        els.map((e) =>
          e.id === pinnedId
            ? { ...e, y: Math.min(1, Math.max(0, e.y + dyNorm)) }
            : e,
        ),
      );
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [pinnedId, setElements, isConfiguringReward]);

  // Esc clears pin/selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPinnedId(null);
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);


  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setElements((els) => els.filter((e) => e.id !== selectedId));
    setSelectedId(null);
  }, [selectedId, setElements]);

  const duplicateSelected = useCallback(() => {
    if (!selectedId) return;
    setElements((els) => {
      const src = els.find((e) => e.id === selectedId);
      if (!src) return els;
      const maxZ = els.reduce((m, e) => Math.max(m, e.z), 0);
      const copy: CanvasElement = {
        ...src,
        id: uid(),
        x: Math.min(1, src.x + 0.04),
        y: Math.min(1, src.y + 0.04),
        z: maxZ + 1,
      };
      queueMicrotask(() => setSelectedId(copy.id));
      return [...els, copy];
    });
  }, [selectedId, setElements]);

  const layer = useCallback(
    (dir: "front" | "back" | "forward" | "backward") => {
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
    },
    [selectedId, setElements],
  );

  const setCameraTarget = useCallback(() => {
    if (!selectedId) return;
    patchActiveScene({ cameraTargetId: selectedId });
    toast({ title: "Camera target set", description: "Use Focus to frame it." });
  }, [selectedId, patchActiveScene, toast]);

  const focusCamera = useCallback(() => {
    const targetId = activeScene?.cameraTargetId ?? selectedId;
    const target = elements.find((e) => e.id === targetId);
    const wrap = canvasWrapRef.current;
    if (!target || !wrap) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    const rect = wrap.getBoundingClientRect();
    const z = 1.7;
    const offX = (target.x - 0.5) * rect.width;
    const offY = (target.y - 0.5) * rect.height;
    setZoom(z);
    setPan({ x: -offX * z, y: -offY * z });
  }, [activeScene, selectedId, elements]);

  const enterFullscreen = useCallback(() => {
    // Try the native API, but always drive a CSS overlay too — the preview
    // iframe blocks the Fullscreen API, so the overlay is the reliable path.
    const el = stageWrapRef.current;
    setStageFull((f) => {
      const next = !f;
      if (next) el?.requestFullscreen?.().catch(() => {});
      else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      return next;
    });
  }, []);

  // Exit CSS fullscreen with Escape and keep state in sync with the native API.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStageFull(false);
    };
    const onFsChange = () => {
      if (!document.fullscreenElement && document.fullscreenEnabled) {
        // native fullscreen ended; leave CSS overlay untouched here
      }
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFsChange);
    };
  }, []);

  // Alt-drag / space-drag panning.
  const panning = useRef<{ active: boolean; sx: number; sy: number; px: number; py: number }>({
    active: false,
    sx: 0,
    sy: 0,
    px: 0,
    py: 0,
  });
  const onStagePointerDown = (e: React.PointerEvent) => {
    if (!e.altKey) return;
    e.preventDefault();
    panning.current = { active: true, sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onStagePointerMove = (e: React.PointerEvent) => {
    if (!panning.current.active) return;
    setPan({
      x: panning.current.px + (e.clientX - panning.current.sx),
      y: panning.current.py + (e.clientY - panning.current.sy),
    });
  };
  const onStagePointerUp = () => {
    panning.current.active = false;
  };
  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom((z) => Math.min(3, Math.max(0.3, +(z - e.deltaY * 0.001).toFixed(2))));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (!selectedIdRef.current) {
        if (e.key === "Escape") setSelectedId(null);
        return;
      }
      const nudge = e.shiftKey ? 0.05 : 0.01;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === "Escape") {
        setSelectedId(null);
      } else if (e.key === "[") {
        layer("back");
      } else if (e.key === "]") {
        layer("front");
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const map: Record<string, [number, number]> = {
          ArrowUp: [0, -nudge],
          ArrowDown: [0, nudge],
          ArrowLeft: [-nudge, 0],
          ArrowRight: [nudge, 0],
        };
        const d = map[e.key];
        if (d)
          setElements((els) =>
            els.map((el) =>
              el.id === selectedIdRef.current
                ? {
                    ...el,
                    x: Math.min(1, Math.max(0, el.x + d[0])),
                    y: Math.min(1, Math.max(0, el.y + d[1])),
                  }
                : el,
            ),
          );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteSelected, layer, setElements]);

  const saveTitle = async () => {
    if (!gameId) return;
    try {
      await renameGame(gameId, title || "Untitled Game");
    } catch (e) {
      console.error(e);
    }
  };

  const saveSubtopic = async () => {
    if (!gameId) return;
    try {
      await updateGameMeta(gameId, { subtopic });
    } catch (e) {
      console.error(e);
    }
  };

  const saveTopic = async () => {
    if (!gameId) return;
    try {
      await updateGameMeta(gameId, { topic });
    } catch (e) {
      console.error(e);
    }
  };

  const saveMeta = async () => {
    if (!gameId) return;
    const t = metaTitle.trim() || "Untitled Game";
    const tp = metaTopic.trim();
    const st = metaSubtopic.trim();
    setTitle(t);
    setTopic(tp);
    setSubtopic(st);
    setAdventureMode(metaMode);
    // Leaving video mode drops the moving background so the static canvas is clean.
    if (metaMode === "static") {
      setVideo(null);
      setVideoPlaying(false);
    }
    try {
      await updateGameMeta(gameId, { title: t, topic: tp, subtopic: st });
    } catch (e) {
      console.error(e);
    }
    setMetaOpen(false);
    // Video Adventure needs a background video before checkpoints can be marked.
    if (metaMode === "video" && !video) openVideoPicker();
  };

  /** Open (or create) the shared "Game Questions" lesson-note for this game.
   *  Every progress bar points at the same note; each still compiles into its
   *  own per-class assessment when the game is assigned. */
  const openQuestions = useCallback(
    async (element: CanvasElement) => {
      if (!gameId) return;
      try {
        // Reuse an existing note from this bar or any other bar in the game.
        const sharedNotebookId =
          element.progress?.questionNotebookId ??
          scenes
            .flatMap((s) => s.elements)
            .find((e) => e.progress?.questionNotebookId)?.progress?.questionNotebookId;
        const notebookId = await ensureGameQuestionNotebook(
          { id: gameId, title, subtopic, topic },
          sharedNotebookId,
        );
        const nextScenes = scenes.map((s) => ({
          ...s,
          elements: s.elements.map((e) =>
            e.id === element.id && e.progress
              ? { ...e, progress: { ...e.progress, questionNotebookId: notebookId } }
              : e,
          ),
        }));
        setScenes(nextScenes);
        await saveGameCanvas(gameId, { scenes: nextScenes, activeSceneId });
        navigate(`/lesson-notes/${notebookId}?game=${gameId}`);
      } catch (e) {
        console.error(e);
        toast({ title: "Could not open questions", variant: "destructive" });
      }
    },
    [gameId, title, subtopic, topic, scenes, activeSceneId, navigate, toast],
  );


  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const slots: { kind: AssetKind; label: string; icon: typeof Image }[] = [
    { kind: "background", label: "Background", icon: Image },
    { kind: "reward", label: "Reward", icon: Trophy },
  ];


  // Switch between Edit / View. When entering View, always exit the
  // reward-configuration flow so the read-only render can take over.
  const handleGalleryModeChange = (m: "edit" | "view") => {
    if (m === "view" && configureRewardParam) {
      const next = new URLSearchParams(searchParams);
      next.delete("configureReward");
      setSearchParams(next, { replace: true });
    }
    setGalleryView(m);
  };

  // Gallery View mode — presentation-only render, identical to what students see.
  if (isGallery && galleryView === "view") {
    return (
      <div className="relative flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <GalleryModeTabs
          mode={galleryView}
          onChange={handleGalleryModeChange}
          title={title}
          backHref={`/teaching-hub/classes/${classId}`}
        />
        <GalleryGroupTabs
          groups={galleryGroups}
          activeId={activeGroupId}
          onChange={setActiveGroupId}
        />
        <div
          className={
            stageFull
              ? "fixed inset-0 z-50 overflow-hidden bg-background"
              : "relative min-h-0 flex-1 overflow-hidden"
          }
        >
          <div ref={galleryScroll.ref} className="h-full w-full overflow-auto">
            {stageFull ? (
              <div
                style={{
                  width: "100vw",
                  height: `calc(100vw * 9 / 16 * ${heightUnits})`,
                }}
              >
                <GameCanvas
                  elements={[...sceneElements, ...galleryAwards.elements]}
                  selectedId={null}
                  pinnedId={null}
                  editable={false}
                  heightUnits={heightUnits}
                  fill
                />
              </div>
            ) : (
              <div className="mx-auto w-full max-w-6xl p-4">
                <GameCanvas
                  elements={[...sceneElements, ...galleryAwards.elements]}
                  selectedId={null}
                  pinnedId={null}
                  editable={false}
                  heightUnits={heightUnits}
                />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={enterFullscreen}
            className="absolute right-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-background/90 px-2.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur hover:bg-muted"
            title={stageFull ? "Exit fullscreen" : "Fullscreen"}
          >
            {stageFull ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {isGallery && (
        <>
          <GalleryModeTabs
            mode={galleryView}
            onChange={handleGalleryModeChange}
            title={title}
            backHref={`/teaching-hub/classes/${classId}`}
          />
          {!isConfiguringReward && (
            <GalleryGroupTabs
              groups={galleryGroups}
              activeId={activeGroupId}
              onChange={setActiveGroupId}
            />
          )}
        </>
      )}

      {/* Collapsible top bar */}
      {topBarOpen && (
        <header className="z-20 flex shrink-0 flex-wrap items-center gap-2 border-b border-border/50 bg-background/95 px-4 py-2.5 backdrop-blur">
          <Link
            to={isGallery ? `/teaching-hub/classes/${classId}` : "/adventure/games"}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> {isGallery ? "Class" : "Games"}
          </Link>
          {isGallery ? (
            <div className="h-8 max-w-[22rem] truncate px-2 text-base font-semibold">
              {title}
            </div>
          ) : (
            <>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={saveTitle}
                placeholder="Game title"
                className="h-8 max-w-[11rem] border-transparent bg-transparent text-base font-semibold focus-visible:border-border"
              />
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onBlur={saveTopic}
                placeholder="Topic"
                className="h-8 max-w-[9rem] border-transparent bg-transparent text-sm text-muted-foreground focus-visible:border-border"
              />
              <Input
                value={subtopic}
                onChange={(e) => setSubtopic(e.target.value)}
                onBlur={saveSubtopic}
                placeholder="Subtopic"
                className="h-8 max-w-[10rem] border-transparent bg-transparent text-sm text-muted-foreground focus-visible:border-border"
              />
            </>
          )}

          <div className="mx-1 h-6 w-px bg-border/60" />

          <Button size="sm" variant="ghost" onClick={focusCamera}>
            <Crosshair className="mr-1.5 h-4 w-4" /> Focus
          </Button>
          <Button size="sm" variant="ghost" onClick={enterFullscreen}>
            <Maximize className="mr-1.5 h-4 w-4" /> Full Screen
          </Button>

          <div className="mx-1 h-6 w-px bg-border/60" />

          {adventureMode === "video" && video && checkpoints.length > 0 ? (
            <Button
              size="sm"
              variant={preview.active ? "secondary" : "ghost"}
              className={cmpBtn}
              onClick={() => {
                if (preview.active) {
                  preview.stop();
                } else {
                  setVideoPlaying(false);
                  setSelectedId(null);
                  preview.start();
                }
              }}
            >
              <Play className={`mr-1 ${cmpIcon}`} /> {preview.active ? "Stop Preview" : "Play Preview"}
            </Button>
          ) : (
            <Button size="sm" variant="ghost" disabled title="Coming soon" className="opacity-60">
              <Play className="mr-1.5 h-4 w-4" /> Play Preview
            </Button>
          )}

          <Button size="sm" variant="ghost" disabled title="Coming soon" className="opacity-60">
            <Radio className="mr-1.5 h-4 w-4" /> Live
          </Button>

          <div className="ml-auto flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5 text-primary" /> Saved
                </>
              )}
            </span>
          </div>
        </header>
      )}

      {/* Full-width fold bar — collapses/expands the whole top toolbar */}
      <button
        type="button"
        onClick={() => setTopBarOpen((v) => !v)}
        className="z-20 flex w-full shrink-0 items-center justify-center gap-1 border-b border-border/50 bg-background/80 py-0.5 text-[10px] font-medium text-muted-foreground backdrop-blur transition hover:bg-muted/50 hover:text-foreground"
        title={topBarOpen ? "Hide toolbar" : "Show toolbar"}
      >
        {topBarOpen ? (
          <>
            <ChevronUp className="h-3 w-3" /> Hide toolbar
          </>
        ) : (
          <>
            <ChevronDown className="h-3 w-3" /> Show toolbar
          </>
        )}
      </button>


      {/* Action row */}
      <div className="z-10 flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border/40 bg-background/80 px-3 py-1 backdrop-blur">
        <button
          type="button"
          onClick={() => { setMetaMode(adventureMode); setMetaOpen(true); }}
          className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
          title="Change title, topic and game mode"
        >
          {adventureModeLabel(adventureMode)}
        </button>
        {adventureMode === "video" && (
          <Button
            size="sm"
            className={cmpBtn}
            variant={video ? "default" : "secondary"}
            onClick={openVideoPicker}
            title="Use a video as the moving background"
          >
            <Video className={cmpIcon} /> Video Background
          </Button>
        )}
        {!video && (
          <span className="mr-1 text-[11px] font-semibold text-muted-foreground">
            Canvas: {heightUnits} section{heightUnits === 1 ? "" : "s"}
          </span>
        )}
        {!video && (
          <>
            <Button size="sm" className={cmpBtn} variant="secondary" onClick={extendCanvas} title="Extend canvas upward by one section (adds space at the top)">
              <Plus className={cmpIcon} /> Extend Canvas
            </Button>
            <Button
              size="sm"
              className={cmpBtn}
              variant="ghost"
              onClick={shrinkCanvas}
              disabled={heightUnits <= 1}
              title="Shrink canvas by one section"
            >
              <Minus className={cmpIcon} /> Shrink
            </Button>
          </>
        )}

        {/* Video Adventure: nothing is editable until the first Loop exists. */}
        {videoGate ? (
          <span className="ml-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
            {video
              ? "Play the video, then Set Start / Set End to create Loop 1"
              : "Upload a background video to begin"}
          </span>
        ) : (
          <>
            <div className="mx-0.5 h-5 w-px bg-border/60" />

            {slots.map((s) => {
              const Icon = s.icon;
              return (
                <Button key={s.kind} size="sm" className={cmpBtn} variant="secondary" onClick={() => openAsset(s.kind)}>
                  <Icon className={cmpIcon} />
                  {s.label}
                </Button>
              );
            })}
            <Button size="sm" className={cmpBtn} variant="secondary" onClick={addProgressTower}>
              <TowerControl className={cmpIcon} /> Progress Bar
            </Button>
            <Button size="sm" className={cmpBtn} onClick={() => openAsset("effect")}>
              <Layers className={cmpIcon} /> Add Effect
            </Button>

            <div className="mx-0.5 h-5 w-px bg-border/60" />

            <Button size="sm" variant="ghost" disabled title="Coming soon" className={`${cmpBtn} opacity-60`}>
              <HelpCircle className={cmpIcon} /> Questions
            </Button>
          </>
        )}


        {adventureMode === "video" && video && checkpoints.length > 0 && (
          <Button
            size="sm"
            className={cmpBtn}
            variant={preview.active ? "default" : "secondary"}
            onClick={() => {
              if (preview.active) {
                preview.stop();
              } else {
                setVideoPlaying(false);
                setSelectedId(null);
                preview.start();
              }
            }}
            title="Run the adventure and stop at each Learning Point"
          >
            <Play className={cmpIcon} /> {preview.active ? "Stop Preview" : "Preview"}
          </Button>
        )}

        <div className="ml-auto flex items-center gap-1.5">

          <Button
            size="sm"
            className={cmpBtn}
            variant={selected && selected.kind !== "background" ? "secondary" : "ghost"}
            disabled={!selected || selected.kind === "background"}
            onClick={setCameraTarget}
          >
            <Camera className={cmpIcon} /> Set Camera Target
          </Button>
          <Button
            size="sm"
            className={cmpBtn}
            variant={drawerOpen ? "default" : "secondary"}
            onClick={() => setDrawerOpen((v) => !v)}
          >
            <Sliders className={cmpIcon} /> Settings
          </Button>
          {!railOpen && (
            <Button size="sm" className={cmpBtn} variant="secondary" onClick={() => setRailOpen(true)}>
              <Layers className={cmpIcon} /> Layers
            </Button>
          )}
        </div>
      </div>


      {video && (
        <CheckpointTimeline
          duration={video.duration ?? 0}
          currentTime={videoTime}
          playing={videoPlaying}
          checkpoints={checkpoints}
          activeId={activeSceneId}
          onTogglePlay={() => setVideoPlaying((v) => !v)}
          onSeek={(t) => {
            videoRef.current?.seek(t);
            setVideoTime(t);
          }}
          onAdd={addCheckpoint}
          onSelect={setActiveSceneId}
          onDelete={deleteCheckpoint}
          onPatch={patchCheckpoint}
          onChangeVideo={openVideoPicker}
          onRemoveVideo={removeVideoBackground}
          expanded={topBarOpen}
          onToggleNarration={() => setNarrationOpen((v) => !v)}
          narrationOpen={narrationOpen}
          narrationCount={narrations.length}
          narrationPanel={
            narrationOpen ? (
              <NarrationPanel
                narrations={narrations}
                playhead={videoTime}
                onChange={setNarrations}
                onClose={() => setNarrationOpen(false)}
              />
            ) : null
          }
        />
      )}

      {/* Static Adventure: one stage = one scene, played in order. */}
      {!video && !isGallery && (
        <SceneStrip
          scenes={scenes}
          activeId={activeScene?.id ?? null}
          onSelect={setActiveSceneId}
          onDuplicate={duplicateScene}
          onDelete={deleteScene}
        />
      )}



      {/* Editing area */}
      <div className="flex min-h-0 flex-1">
        <main
          ref={stageWrapRef}
          className={
            stageFull
              ? "fixed inset-0 z-50 overflow-hidden bg-background"
              : "relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_center,hsl(var(--muted)/0.35),transparent)]"
          }
        >
          {/* Scrollable stage — canvas scrolls up/down independently of the pinned rows */}
          <div
            ref={(el) => {
              stageScrollRef.current = el;
              if (isGallery) galleryScroll.ref(el);
            }}
            className="h-full w-full overflow-auto"
            onPointerDown={onStagePointerDown}
            onPointerMove={onStagePointerMove}
            onPointerUp={onStagePointerUp}
            onWheel={onWheel}
          >
            <div
              className={
                stageFull
                  ? "block w-full"
                  : "flex min-h-full w-full items-start justify-center p-4"
              }
              style={
                stageFull
                  ? { width: "100vw", height: `calc(100vw * 9 / 16 * ${heightUnits})` }
                  : undefined
              }
            >
              <div
                ref={canvasWrapRef}
                className={
                  stageFull
                    ? "h-full w-full"
                    : "w-full transition-transform"
                }

                style={
                  stageFull
                    ? undefined
                    : {
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: "top center",
                      }
                }
              >
                {video ? (
                  <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "16 / 9" }}>
                    <VideoBackgroundLayer
                      ref={videoRef}
                      video={video}
                      playing={preview.active ? preview.playing : videoPlaying}
                      loop={
                        preview.active
                          ? preview.loopRegion
                          : videoPlaying && insideActiveLoop && activeScene?.loopEnd != null
                            ? { start: activeScene.loopStart ?? 0, end: activeScene.loopEnd }
                            : null
                      }
                      onTime={(t) => {
                        setVideoTime(t);
                        if (preview.active) {
                          preview.onTime(t);
                          narrationRuntime.onTime(t);
                        }
                      }}
                      onLoaded={(meta) =>
                        setVideo((v) =>
                          v ? { ...v, duration: meta.duration, width: meta.width, height: meta.height } : v,
                        )
                      }
                      onEnded={() => {
                        // Reaching the end of the video never completes a
                        // Learning Point — the runtime decides.
                        if (preview.active) {
                          preview.videoEnded();
                          return;
                        }
                        setVideoPlaying(false);
                      }}
                    />
                    {/* No status text on the canvas — it must look like the
                        real game. Visibility is logged to the console instead. */}

                    <div className="absolute inset-0">
                      <GameCanvas
                        elements={
                          preview.active
                            ? preview.visibleElements(allSceneElements)
                            : insideActiveLoop
                              ? elements
                              : []
                        }
                        selectedId={preview.active ? null : selectedId}
                        pinnedId={pinnedId}
                        editable={!preview.active}
                        onSelect={handleSelect}
                        onMove={moveElement}
                        heightUnits={1}
                        fill
                        transparent
                      />
                    </div>

                    {/* Preview HUD — the teacher drives progression */}
                    {preview.active && (
                      <div className="absolute inset-x-0 bottom-0 z-20 flex flex-wrap items-center gap-2 bg-gradient-to-t from-black/85 to-transparent px-3 py-2 text-[11px] text-white">
                        <span className="rounded bg-white/15 px-2 py-0.5 font-semibold uppercase tracking-wide">
                          Preview
                        </span>
                        {preview.playing ? (
                          <Button size="sm" variant="secondary" className={cmpBtn} onClick={preview.pause}>
                            <Minus className={cmpIcon} /> Pause
                          </Button>
                        ) : (
                          <Button size="sm" variant="secondary" className={cmpBtn} onClick={preview.play}>
                            <Play className={cmpIcon} /> Play
                          </Button>
                        )}
                        <Button
                          size="sm"
                          className={cmpBtn}
                          disabled={!preview.activeLoopId || !!preview.exitingLoopId || preview.ended}
                          onClick={preview.next}
                        >
                          <Check className={cmpIcon} />
                          {previewFinalLoop ? "Complete Adventure" : "Next Learning Point"}
                        </Button>
                        <Button size="sm" variant="ghost" className={`${cmpBtn} text-white hover:bg-white/15`} onClick={() => { preview.stop(); setVideoPlaying(false); }}>
                          <X className={cmpIcon} /> Exit Preview
                        </Button>
                        <span className="ml-auto text-white/80">
                          {preview.ended
                            ? "Adventure complete — final reward stored in the Class Gallery"
                            : preview.exitingLoopId
                              ? "Learning Point cleared — finishing the shot…"
                              : preview.activeLoopId
                                ? `Looping ${checkpoints.find((c) => c.id === preview.activeLoopId)?.title ?? "Learning Point"}`
                                : "Playing…"}
                        </span>
                      </div>
                    )}
                    {preview.active && preview.ended && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/70 text-white">
                        <Trophy className="h-8 w-8 text-amber-300" />
                        <p className="text-sm font-semibold">Adventure complete</p>
                        <p className="text-[11px] text-white/70">Final reward collected · Class Gallery opens for students</p>
                        <Button size="sm" className={cmpBtn} onClick={preview.start}>
                          <Play className={cmpIcon} /> Replay preview
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (

                  <GameCanvas
                    elements={elements}
                    selectedId={selectedId}
                    pinnedId={pinnedId}
                    editable
                    onSelect={handleSelect}
                    onMove={moveElement}
                    heightUnits={heightUnits}
                    fill={stageFull}
                  />
                )}

              </div>
            </div>
          </div>

          {/* Zoom controls — pinned to the stage viewport */}
          <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1 rounded-lg border border-border/50 bg-background/90 p-1 text-xs shadow-sm backdrop-blur">
            {stageFull && (
              <button
                className="rounded px-1.5 py-0.5 hover:bg-muted"
                onClick={enterFullscreen}
                title="Exit fullscreen"
              >
                Exit
              </button>
            )}
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.1).toFixed(2)))} title="Zoom out">
              <Minus className="h-4 w-4" />
            </Button>
            <button className="rounded px-1.5 py-0.5 hover:bg-muted" onClick={resetView} title="Fit">Fit</button>
            <button className="rounded px-1.5 py-0.5 hover:bg-muted" onClick={() => { setZoom(1); }} title="100%">100%</button>
            <button className="rounded px-1.5 py-0.5 hover:bg-muted" onClick={() => setZoom(2)} title="200%">200%</button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))} title="Zoom in">
              <Plus className="h-4 w-4" />
            </Button>
            <span className="w-10 text-center text-muted-foreground">{Math.round(zoom * 100)}%</span>
          </div>
          <button
            type="button"
            onClick={enterFullscreen}
            className="absolute right-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-background/90 px-2.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur hover:bg-muted"
            title={stageFull ? "Exit fullscreen" : "Fullscreen"}
          >
            {stageFull ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
          <p className="pointer-events-none absolute bottom-4 right-4 z-10 rounded bg-background/70 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur">
            Alt-drag to pan · scroll or Ctrl+wheel
          </p>
        </main>

        {/* Layers rail */}
        {railOpen && (
          <EffectsRail
            elements={elements}
            selectedId={selectedId}
            cameraTargetId={activeScene?.cameraTargetId}
            onSelect={setSelectedId}
            onClose={() => setRailOpen(false)}
          />
        )}

        {/* Settings drawer */}
        {(drawerOpen || isConfiguringReward) && (
          <aside className="flex h-full w-[20%] min-w-[15rem] max-w-[24rem] shrink-0 flex-col border-l border-border/50 bg-background/95 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between border-b border-border/50 px-3 py-2.5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {isConfiguringReward ? "Reward Settings" : "Edit item"}
              </h2>
              {!isConfiguringReward && (
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDrawerOpen(false)} title="Fold panel">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {isConfiguringReward ? (
                <RewardConfigPanel
                  label={rewardSource?.label || "Reward"}
                  draft={rewardDraft}
                  startSet={rewardStartSet}
                  endSet={rewardEndSet}
                  previewing={rewardPreviewing}
                  onCapture={recordRewardPoint}
                  onPatch={(p) => setRewardDraft((d) => ({ ...d, ...p }))}
                  onPreview={previewReward}
                  onSave={saveReward}
                  onCancel={cancelReward}
                  saving={rewardSaving}
                />
              ) : (
                <SettingsPanel
                  element={selected}
                  onChange={patchElement}
                  onDelete={deleteSelected}
                  onLayer={layer}
                  onDuplicate={duplicateSelected}
                  onOpenEnergyPicker={() => openAsset("effect", true)}
                  energyRefreshKey={energyRefreshKey}
                  onOpenQuestions={openQuestions}
                />
              )}
            </div>
          </aside>
        )}
      </div>


      <AssetLibraryModal
        open={assetOpen}
        onOpenChange={setAssetOpen}
        kind={activeKind}
        onKindChange={setActiveKind}
        onPickUploaded={onPickUploaded}
        onPickUrl={onPickUrl}
        onPickPreset={onPickPreset}
      />

      {/* Title + Topic + Subtopic — all required so AI questions have context */}
      <Dialog open={metaOpen} onOpenChange={(o) => { if (!o && metaTitle.trim() && metaTopic.trim() && metaSubtopic.trim()) setMetaOpen(false); }}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Name this game</DialogTitle>
            <DialogDescription>
              The title, topic and subtopic tell the AI what questions to generate
              (e.g. “Quadratic Equations” · “Algebra” · “Quadratic Formula”).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Title</Label>
              <Input
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                placeholder="Quadratic Equations"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Topic</Label>
              <Input
                value={metaTopic}
                onChange={(e) => setMetaTopic(e.target.value)}
                placeholder="Algebra"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Subtopic</Label>
              <Input
                value={metaSubtopic}
                onChange={(e) => setMetaSubtopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && metaTitle.trim() && metaTopic.trim() && metaSubtopic.trim() && saveMeta()}
                placeholder="Quadratic Formula"
              />
            </div>

            {/* Game mode — how the adventure is staged. More modes land here. */}
            <div className="space-y-1.5 pt-1">
              <Label className="text-xs text-muted-foreground">Game mode</Label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    {
                      id: "static" as AdventureMode,
                      name: "Static Adventure",
                      blurb: "Still background image with a scrollable canvas.",
                    },
                    {
                      id: "video" as AdventureMode,
                      name: "Video Adventure",
                      blurb: "Moving video background with looping Checkpoints.",
                    },
                  ]
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMetaMode(m.id)}
                    className={`rounded-lg border p-2.5 text-left transition ${
                      metaMode === m.id
                        ? "border-primary bg-primary/10"
                        : "border-border/60 hover:bg-muted"
                    }`}
                  >
                    <div className="text-xs font-semibold text-foreground">{m.name}</div>
                    <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                      {m.blurb}
                    </div>
                  </button>
                ))}
              </div>
              {metaMode === "video" && (
                <p className="text-[11px] text-muted-foreground">
                  You'll pick the background video next, then mark Checkpoints on its timeline.
                </p>
              )}
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

/** One shared Gallery layout, one tab per group. Tabs only switch which
 *  earned rewards are shown — background, effects and layout never change. */
const GalleryGroupTabs = ({
  groups,
  activeId,
  onChange,
}: {
  groups: AdventureGroup[];
  activeId: string | null;
  onChange: (id: string | null) => void;
}) => {
  if (groups.length === 0) return null;
  const tabs: Array<{ id: string | null; name: string }> = [
    { id: null, name: "Whole Class" },
    ...groups.map((g) => ({ id: g.id as string | null, name: g.name })),
  ];
  return (
    <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border/50 bg-background/95 px-4 py-1.5">
      {tabs.map((t) => (
        <button
          key={t.id ?? "whole-class"}
          type="button"
          onClick={() => onChange(t.id)}
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
            (activeId ?? null) === t.id
              ? "bg-primary text-primary-foreground"
              : "border border-border text-muted-foreground hover:bg-muted"
          }`}
        >
          {t.name}
        </button>
      ))}
    </div>
  );
};

const GalleryModeTabs = ({

  mode,
  onChange,
  title,
  backHref,
}: {
  mode: "edit" | "view";
  onChange: (m: "edit" | "view") => void;
  title: string;
  backHref: string;
}) => (
  <div className="z-30 flex shrink-0 items-center gap-2 border-b border-border/50 bg-background/95 px-4 py-2 backdrop-blur">
    <Link
      to={backHref}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" /> Class
    </Link>
    <div className="truncate px-2 text-sm font-semibold">{title}</div>
    <div className="ml-auto inline-flex overflow-hidden rounded-lg border border-border/60 bg-muted/30 p-0.5">
      {(["edit", "view"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={
            "px-3 py-1 text-xs font-medium capitalize transition " +
            (mode === m
              ? "rounded-md bg-background text-foreground shadow"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          {m}
        </button>
      ))}
    </div>
  </div>
);

export default GameEditorPage;
