// Interactive teaching video — the player.
//
// ONE video file, virtual sections. The mathematics has priority: whenever the
// current mathematical line changes, the video seeks to that line's teaching
// section and (unless the line is already correct) plays it, stopping exactly
// at the section's end checkpoint. The player's own Previous / Next / Replay
// controls move ONLY the video — they never touch the board state.
//
// Presentation rule: the video's own aspect ratio is the source of truth. The
// stage measures the space it has been given and centres the LARGEST box with
// that ratio which fits — never stretched, never cropped. Whatever is left
// over is the player surround, a quiet dark surface that belongs to the player.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ChevronLeft, ChevronRight, Crosshair, Loader2, Maximize2, Minimize2, Pause, Play,
  RotateCcw, Volume1, Volume2, VolumeX,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { courseMediaUrl } from "@/lib/courses/media";
import {
  CONCLUSION_KEY,
  fmtClock,
  INTRO_KEY,
  nextSection,
  prevSection,
  sectionForLine,
  sectionsFor,
  shouldAutoPlay,
  type QuestionVideoConfig,
  type VideoLine,
} from "@/lib/courses/questionVideo";
import { cn } from "@/lib/utils";

export interface LineContext {
  questionId: string | null;
  lineId: string | null;
  index: number;
  total: number;
  completed: boolean;
  /** The line whose mark was awarded most recently — a marking EVENT, not a
   *  visit. The Conclusion listens to this, so it can never fire merely
   *  because the cursor is sitting on an already-correct final line. */
  lastAwardedLineId?: string | null;
  /** False until the student really activates a line. While false the board's
   *  default cursor must NOT move the video — the Introduction owns the open. */
  lineEngaged?: boolean;
  /** Increments when Reset starts a fresh playback sequence without remounting. */
  playbackResetGeneration?: number;
}


interface Props {
  config: QuestionVideoConfig;
  lines: VideoLine[];
  lineContext: LineContext;
  className?: string;
}

const EPS = 0.08;
/** Until the file reports its own dimensions, assume the usual landscape shape. */
const DEFAULT_RATIO = 16 / 9;

const VOL_KEY = "smartboard:videoVolume";
const MUTE_KEY = "smartboard:videoMuted";

const QuestionVideoPane = ({ config, lines, lineContext, className }: Props) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const introDoneRef = useRef(false);
  const conclusionDoneRef = useRef(false);

  // ── Audio: ONE state for the whole session, shared by all three views ────
  // `muted` is USER intent only. `forcedMute` is the temporary silence a
  // browser imposes when it refuses sound-on autoplay; it is never saved and
  // it clears on the first interaction anywhere in the app.
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [forcedMute, setForcedMute] = useState(false);
  const mutedRef = useRef(false);
  mutedRef.current = muted;

  



  // ── Presentation state: measured stage + the file's own aspect ratio ─────
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [ratio, setRatio] = useState(DEFAULT_RATIO);
  const [fullscreen, setFullscreen] = useState(false);
  /** Used only when the browser refuses the Fullscreen API. */
  const [filling, setFilling] = useState(false);

  const sections = useMemo(() => sectionsFor(lines, config), [lines, config]);
  const active = useMemo(
    () => sections.find((s) => s.key === activeKey) ?? null,
    [sections, activeKey],
  );

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setMediaReady(false);
    introDoneRef.current = false;
    conclusionDoneRef.current = false;
    conclusionHoldRef.current = false;
    handledLineRef.current = null;
    setActiveKey(null);
    setPlayhead(0);
    void courseMediaUrl(config.videoPath)
      .then((next) => {
        if (cancelled) return;
        setUrl(next);
        if (!next) setFailed(true);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [config.videoPath]);

  /** Restore the session's volume. Sound is ON by default every session. */
  useEffect(() => {
    try {
      const v = Number(window.localStorage.getItem(VOL_KEY));
      if (Number.isFinite(v) && v > 0 && v <= 1) setVolume(v);
      // An older build could save an involuntary mute; never honour it again.
      window.localStorage.removeItem(MUTE_KEY);
    } catch { /* private mode */ }
  }, []);

  /** ONE element, ONE audio state — applied on every change and on load. */
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.volume = Math.min(1, Math.max(0, volume));
    el.muted = muted || forcedMute;
    try {
      window.localStorage.setItem(VOL_KEY, String(volume));
    } catch { /* private mode */ }
  }, [volume, muted, forcedMute, url]);

  /**
   * Sound needs one user gesture somewhere in the app before a browser will
   * allow it. The listener is mounted from the start — opening the board,
   * pressing Present, tapping a floating chip all count — and shares the
   * platform-wide latch, so in practice the very first clip already speaks.
   * If a clip did start silent, it unmutes in place and keeps going.
   */
  useEffect(() => {
    if (audioUnlocked()) return;
    const enable = () => {
      unlockAudio();
      setForcedMute(false);
      const el = videoRef.current;
      if (el) {
        el.muted = mutedRef.current;
        if (el.paused) void el.play().catch(() => undefined);
      }
    };
    window.addEventListener("pointerdown", enable, { once: true });
    window.addEventListener("keydown", enable, { once: true });
    window.addEventListener("touchstart", enable, { once: true });
    return () => {
      window.removeEventListener("pointerdown", enable);
      window.removeEventListener("keydown", enable);
      window.removeEventListener("touchstart", enable);
    };
  }, []);




  /** The stage measures itself, so the same code fits any screen or panel. */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      setBox({ w: r.width, h: r.height });
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    window.addEventListener("orientationchange", read);
    return () => { ro.disconnect(); window.removeEventListener("orientationchange", read); };
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  /** Largest box with the video's ratio that fits the measured area. */
  const fitted = useMemo(() => {
    if (box.w <= 0 || box.h <= 0) return { width: 0, height: 0 };
    const byWidth = box.w / ratio;
    if (byWidth <= box.h) return { width: box.w, height: byWidth };
    return { width: box.h * ratio, height: box.h };
  }, [box, ratio]);

  const toggleFullscreen = async () => {
    const el = rootRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
        setFilling(false);
        return;
      }
      await el.requestFullscreen();
      setFilling(false);
    } catch {
      // Fullscreen API blocked (embedded preview, permissions) — fill the viewport.
      setFilling((f) => !f);
    }
  };

  /**
   * Move the video only. Activating any segment pauses whatever was speaking,
   * so there is never more than one instructional audio source.
   */
  const goTo = useCallback((key: string | null, autoplay: boolean) => {
    if (!key) return;
    const target = sections.find((s) => s.key === key);
    // A section the teacher never gave a range to has no video of its own: the
    // player stays exactly where it is rather than inventing a slice.
    if (!target || !target.configured) return;
    setActiveKey(key);
    const el = videoRef.current;
    if (!el) return;
    el.pause();
    try { el.currentTime = target.start; } catch { /* not seekable yet */ }
    if (!autoplay) return;
    el.muted = muted;
    void el.play().catch(() => {
      // Sound-on autoplay refused: keep teaching, ask for one gesture.
      el.muted = true;
      setNeedsSound(true);
      void el.play().catch(() => undefined);
    });
  }, [sections, muted]);

  // ── STAGE 1 · The Introduction opens the lesson ─────────────────────────
  // It starts by itself, with sound, the moment the board is ready — the
  // student presses nothing. It keeps playing until the FIRST real line
  // activation, which is why the line effect below waits for engagement.
  useEffect(() => {
    if (!config.introEnabled || introDoneRef.current) return;
    if (!sections.some((s) => s.key === INTRO_KEY)) return;
    if (!url || !mediaReady || !videoRef.current) return;
    goTo(INTRO_KEY, true);
    // This guard is set only after goTo has reached the mounted media element.
    introDoneRef.current = true;
  }, [config.introEnabled, sections, goTo, mediaReady, url]);

  /** The Conclusion is the closing stage: once it starts it plays to the end. */
  const conclusionHoldRef = useRef(false);

  // ── STAGE 2 · Mathematics drives the video ──────────────────────────────
  // An EVENT, not a state mirror. The board reports a default cursor (Line 1)
  // before the student has done anything, so nothing here fires until
  // `lineEngaged` says a real activation happened — # / a floating chip /
  // Present / Next / Previous / a table cell. From then on, every change of
  // the active line stops whatever is speaking and seeks to that line's own
  // start; a finished clip NEVER advances the line by itself.
  const handledLineRef = useRef<string | null>(null);
  useEffect(() => {
    if (lineContext.lineEngaged === false) return;
    const lineId = lineContext.lineId;
    if (!lineId || handledLineRef.current === lineId) return;
    const target = sectionForLine(sections, lineId);
    if (!target) return;
    handledLineRef.current = lineId;
    introDoneRef.current = true;
    // The closing stage is never interrupted by a late line activation.
    if (conclusionHoldRef.current) return;
    goTo(target.key, shouldAutoPlay({ lineCompleted: lineContext.completed }));
  }, [sections, lineContext.lineId, lineContext.completed, lineContext.lineEngaged, goTo]);

  const resetGenerationRef = useRef(lineContext.playbackResetGeneration ?? 0);
  useEffect(() => {
    const next = lineContext.playbackResetGeneration ?? 0;
    if (next === resetGenerationRef.current) return;
    resetGenerationRef.current = next;
    const el = videoRef.current;
    if (el) {
      el.pause();
      try { el.currentTime = 0; } catch { /* media may be changing */ }
    }
    setActiveKey(null);
    setPlayhead(0);
    setNeedsSound(false);
    introDoneRef.current = false;
    handledLineRef.current = null;
    conclusionDoneRef.current = false;
    conclusionHoldRef.current = false;
    // Reset is an explicit new board-open event. Restart the optional
    // Introduction immediately when media is ready; otherwise the readiness
    // effect above will start it when metadata arrives.
    if (config.introEnabled && mediaReady && url && videoRef.current
      && sections.some((section) => section.key === INTRO_KEY)) {
      goTo(INTRO_KEY, true);
      introDoneRef.current = true;
    }
  }, [
    config.introEnabled,
    goTo,
    lineContext.playbackResetGeneration,
    mediaReady,
    sections,
    url,
  ]);

  // ── STAGE 3 · The Conclusion, on the MARKING of the final line ───────────
  // Reaching or watching the final line is not enough: the mark must actually
  // have been awarded. Once per session, then it runs to the end of the file.
  // The last line that can actually be MARKED: a trailing note-only line
  // (preview NULL) never receives an award, so it cannot gate the Conclusion.
  const finalLineId =
    [...lines].reverse().find((l) => l.preview != null)?.lineId ??
    (lines.length ? lines[lines.length - 1].lineId : null);
  useEffect(() => {
    if (!config.conclusionEnabled || conclusionDoneRef.current) return;
    if (!finalLineId || !lineContext.lastAwardedLineId) return;
    if (lineContext.lastAwardedLineId !== finalLineId) return;
    if (!sections.some((s) => s.key === CONCLUSION_KEY)) return;
    conclusionDoneRef.current = true;
    conclusionHoldRef.current = true;
    goTo(CONCLUSION_KEY, true);
  }, [config.conclusionEnabled, finalLineId, lineContext.lastAwardedLineId, sections, goTo]);


  /** A section with no real span cannot stop playback — it would freeze on arrival. */
  const bounded = !!active && active.end - active.start > EPS;

  // Stop at the section's end checkpoint — never spill into the next line.
  const onTimeUpdate = () => {
    const el = videoRef.current;
    if (!el) return;
    setPlayhead(el.currentTime);
    if (!active || !bounded || active.key === CONCLUSION_KEY) return;
    if (el.currentTime >= active.end - EPS) {
      el.pause();
      try { el.currentTime = active.end; } catch { /* ignore */ }
    }
  };



  const toggle = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      if (active && bounded && el.currentTime >= active.end - EPS) {
        try { el.currentTime = active.start; } catch { /* ignore */ }
      }
      // A press is a real gesture, so sound is allowed from here on.
      setNeedsSound(false);
      el.muted = muted;
      void el.play().catch(() => undefined);
    } else {
      el.pause();
    }
  };

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;


  const backToMyLine = () => {
    const target = sectionForLine(sections, lineContext.lineId);
    conclusionHoldRef.current = false;
    if (target) goTo(target.key, false);
  };


  const progress = active && active.end > active.start
    ? Math.min(1, Math.max(0, (playhead - active.start) / (active.end - active.start)))
    : 0;

  const expanded = fullscreen || filling;

  return (
    <div
      ref={rootRef}
      className={cn(
        // The player surround: a quiet, very dark neutral surface with a
        // barely-there gradient. No borders, no cards, no shadows.
        "relative flex h-full min-h-0 w-full flex-col overflow-hidden",
        "bg-[linear-gradient(180deg,hsl(215_28%_9%),hsl(215_30%_6%))]",
        expanded ? "fixed inset-0 z-[80] h-[100dvh] w-screen rounded-none" : "rounded-xl",
        className,
      )}
    >
      {/* Stage — measures its own box and centres the fitted video inside it. */}
      <div ref={stageRef} className="relative min-h-0 flex-1">
        {url ? (
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{
              width: fitted.width ? `${fitted.width}px` : "100%",
              height: fitted.height ? `${fitted.height}px` : "100%",
            }}
          >
            <video
              ref={videoRef}
              src={url}
              playsInline
              className="h-full w-full bg-black object-contain"
              onLoadedMetadata={(e) => {
                const w = e.currentTarget.videoWidth;
                const h = e.currentTarget.videoHeight;
                if (w > 0 && h > 0) setRatio(w / h);
                e.currentTarget.volume = Math.min(1, Math.max(0, volume));
                e.currentTarget.muted = muted;
                setMediaReady(true);
              }}
              onCanPlay={() => setMediaReady(true)}
              onError={() => setFailed(true)}
              onTimeUpdate={onTimeUpdate}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => {
                setPlaying(false);
                if (active?.key === CONCLUSION_KEY) conclusionHoldRef.current = false;
              }}
              onDoubleClick={() => void toggleFullscreen()}
            />
          </div>
        ) : failed ? (
          <span className="absolute inset-0 inline-flex flex-col items-center justify-center gap-1 px-6 text-center text-xs text-white/70">
            <AlertTriangle className="h-4 w-4" />
            This teaching video isn't available right now — the Smartboard still works.
          </span>
        ) : (
          <span className="absolute inset-0 inline-flex items-center justify-center gap-2 text-xs text-white/70">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading the teaching video…
          </span>
        )}

        {needsSound && (
          <button
            type="button"
            onClick={() => { setNeedsSound(false); setMuted(false); }}
            className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur"
          >
            Tap for sound
          </button>
        )}


        {/* Controls overlay the bottom of the stage, so entering or leaving
            full screen never resizes the video or shifts the page. */}
        <div className="absolute inset-x-0 bottom-0 space-y-2 bg-gradient-to-t from-black/75 via-black/45 to-transparent p-2 pt-8">
          <div className="flex items-center justify-between gap-2 text-[11px] text-white/75">
            <span className="min-w-0 truncate">{active ? active.label : "Teaching video"}</span>
            <span className="shrink-0 font-mono">
              {fmtClock(Math.max(0, playhead - (active?.start ?? 0)))} /{" "}
              {fmtClock(
                bounded
                  ? Math.max(0, (active?.end ?? 0) - (active?.start ?? 0))
                  : Math.max(0, config.duration - (active?.start ?? 0)),
              )}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/20">
            <div className="h-full bg-white/85" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-white hover:bg-white/15"
              aria-label="Previous section"
              onClick={() => { conclusionHoldRef.current = false; goTo(prevSection(sections, activeKey)?.key ?? null, false); }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-white hover:bg-white/15"
              aria-label={playing ? "Pause" : "Play"}
              onClick={toggle}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-white hover:bg-white/15"
              aria-label="Replay this section"
              onClick={() => goTo(activeKey, true)}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-white hover:bg-white/15"
              aria-label="Next section"
              onClick={() => { conclusionHoldRef.current = false; goTo(nextSection(sections, activeKey)?.key ?? null, false); }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            {/* Audio control — always visible: press the icon to mute, drag to
                set the level. One state for the whole session, so it survives
                every switch between Smartboard, Split view and Video. */}
            <div className="flex items-center">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-white hover:bg-white/15"
                aria-label={muted ? "Unmute" : "Mute"}
                title={muted ? "Unmute" : "Mute"}
                onClick={() => {
                  setNeedsSound(false);
                  setMuted((m) => {
                    const next = !m;
                    if (!next && volume === 0) setVolume(0.7);
                    return next;
                  });
                }}
              >
                <VolumeIcon className="h-4 w-4" />
              </Button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                aria-label="Volume"
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setVolume(next);
                  setMuted(next === 0);
                  setNeedsSound(false);
                }}
                className="ml-1 h-1 w-16 cursor-pointer accent-white sm:w-20"
              />

            </div>

            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-8 gap-1 text-[11px] text-white hover:bg-white/15"
              onClick={backToMyLine}
            >
              <Crosshair className="h-3.5 w-3.5" /> Back to my line
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-white hover:bg-white/15"
              aria-label={expanded ? "Exit full screen" : "Full screen"}
              title={expanded ? "Exit full screen" : "Full screen"}
              onClick={() => void toggleFullscreen()}
            >
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionVideoPane;
