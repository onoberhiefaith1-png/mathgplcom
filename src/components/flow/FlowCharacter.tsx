// Plays the supplied clips as one continuous timeline and renders only the
// requested scene range. It never cuts a scene: it reports onSceneEnd when the
// scene's end point is reached.
//
// Transparent Video render paths:
//  1. Native alpha channel (preferred, e.g. WebM VP9 with alpha) — the frame is
//     drawn straight to the canvas and its own alpha is preserved untouched.
//  2. Baked-in checkerboard — an opaque file that has the transparency preview
//     pattern in its pixels. A GPU pass converts that back into real alpha at
//     playback time; the file itself is never altered.
//  3. Stacked matte — an older processed clip (colour on top, matte below).
import { useEffect, useRef, useState } from "react";
import type { FlowClip } from "@/lib/flow/types";
import { flowUrl } from "@/lib/flow/api";
import { locate } from "@/lib/flow/segments";
import { createLiveKeyer, type LiveKeyer } from "@/lib/flow/liveKey";
import { probeTransparency } from "@/lib/flow/alpha";

interface Props {
  clips: FlowClip[];
  range: { start: number; end: number } | null;
  /** Changes every time a scene (even the same one) must (re)start. */
  playKey: number;
  onSceneEnd: () => void;
  visible: boolean;
  className?: string;
  /** 0..1 universal Flow volume. Omit/0 to mute. */
  volume?: number;
  onAudioBlocked?: () => void;
  /** Kept for compatibility; live keying means clips are never hidden. */
  requireCutout?: boolean;
}

// Transparency classification lives in @/lib/flow/alpha.

export const FlowCharacter = ({ clips, range, playKey, onSceneEnd, visible, className, volume = 0, onAudioBlocked }: Props) => {
  const glRef = useRef<HTMLCanvasElement>(null);
  const cpuRef = useRef<HTMLCanvasElement>(null);
  const keyerRef = useRef<LiveKeyer | null>(null);
  const videosRef = useRef<HTMLVideoElement[]>([]);
  // Audio source per clip: the original upload when the visual is a processed
  // (silent) stacked WebM, otherwise the visual video itself.
  const audioRef = useRef<(HTMLVideoElement | null)[]>([]);
  const volRef = useRef(volume);
  volRef.current = volume;
  const blockedRef = useRef(onAudioBlocked);
  blockedRef.current = onAudioBlocked;
  const [ready, setReady] = useState(false);
  const endRef = useRef(onSceneEnd);
  endRef.current = onSceneEnd;

  // Build hidden videos for every clip.
  useEffect(() => {
    let alive = true;
    setReady(false);
    (async () => {
      const vids = await Promise.all(
        clips.map(async (c) => {
          const v = document.createElement("video");
          v.crossOrigin = "anonymous";
          v.muted = true;
          v.playsInline = true;
          v.preload = "auto";
          v.src = (await flowUrl(c.processedPath || c.path)) ?? "";
          let a: HTMLVideoElement | null = null;
          if (c.processedPath) {
            a = document.createElement("video");
            a.playsInline = true;
            a.preload = "auto";
            a.src = (await flowUrl(c.path)) ?? "";
          }
          return [v, a] as const;
        }),
      );
      if (!alive) return;
      videosRef.current = vids.map((x) => x[0]);
      audioRef.current = vids.map((x) => x[1]);
      setReady(true);
    })();
    return () => {
      alive = false;
      [...videosRef.current, ...audioRef.current].forEach((v) => { if (!v) return; v.pause(); v.removeAttribute("src"); v.load(); });
      videosRef.current = [];
      audioRef.current = [];
    };
  }, [clips.map((c) => c.processedPath || c.path).join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  // One GPU keyer for the lifetime of the component.
  useEffect(() => {
    const c = glRef.current;
    if (!c) return;
    keyerRef.current = createLiveKeyer(c);
    return () => { keyerRef.current?.dispose(); keyerRef.current = null; };
  }, []);

  // After a browser autoplay block, the first click anywhere restores sound.
  useEffect(() => {
    const unlock = () => {
      const vol = Math.max(0, Math.min(1, volRef.current));
      if (vol === 0) return;
      videosRef.current.forEach((v, i) => {
        const a = audioRef.current[i];
        const src = a ?? v;
        if (!src.paused) { src.muted = false; src.volume = vol; }
      });
    };
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  useEffect(() => {
    if (!ready || !range) return;
    const vids = videosRef.current;
    if (!vids.length) return;
    let raf = 0;
    let done = false;
    const auds = audioRef.current;
    const silenceAll = () => {
      vids.forEach((v) => { v.pause(); v.muted = true; });
      auds.forEach((a) => a && a.pause());
    };
    const start = (i: number, t: number) => {
      silenceAll();
      const v = vids[i], a = auds[i];
      const vol = Math.max(0, Math.min(1, volRef.current));
      v.currentTime = t;
      if (a) {
        a.currentTime = t; a.volume = vol; a.muted = vol === 0;
        a.play().catch(() => { a.muted = true; blockedRef.current?.(); a.play().catch(() => {}); });
        v.play().catch(() => {});
      } else {
        v.volume = vol; v.muted = vol === 0;
        v.play().catch(() => { v.muted = true; blockedRef.current?.(); v.play().catch(() => {}); });
      }
    };
    let loc = locate(clips, range.start);
    let active = vids[loc.index];
    start(loc.index, loc.local);

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const clip = clips[loc.index];
      const global = loc.offset + active.currentTime;
      // Cross into next clip when this one ends but the scene continues.
      if ((active.ended || active.currentTime >= (clip.duration || 0) - 0.03) && global < range.end - 0.05 && loc.index < clips.length - 1) {
        active.pause();
        loc = { index: loc.index + 1, local: 0, offset: loc.offset + (clip.duration || 0) };
        active = vids[loc.index];
        start(loc.index, 0);
        return;
      }
      if (!done && (global >= range.end - 0.02 || (active.ended && loc.index === clips.length - 1))) {
        done = true;
        silenceAll();
        endRef.current();
        return;
      }
      // Keep volume live and the hidden audio in sync with the picture.
      const a = auds[loc.index];
      const vol = Math.max(0, Math.min(1, volRef.current));
      if (a) {
        if (!a.muted || vol === 0) { a.volume = vol; a.muted = vol === 0; }
        if (Math.abs(a.currentTime - active.currentTime) > 0.15) a.currentTime = active.currentTime;
      } else if (!active.muted || vol === 0) { active.volume = vol; active.muted = vol === 0; }

      if (active.readyState < 2) return;
      const stacked = !!clip.processedPath;
      const vw = active.videoWidth;
      const vh = stacked ? Math.floor(active.videoHeight / 2) : active.videoHeight;
      if (!vw || !vh) return;

      if (!stacked) {
        const kind = probeTransparency(active, clip.processedPath || clip.path);
        const keyer = keyerRef.current;
        // ── Path 2: opaque file with the checkerboard baked in ──
        if (keyer && (kind === "checker" || kind === null)) {
          const gl = glRef.current, cpu = cpuRef.current;
          if (gl) gl.style.opacity = "1";
          if (cpu) cpu.style.opacity = "0";
          keyer.render(active, vw, vh, clip.edgeStrength ?? "normal");
          return;
        }
        // ── Path 1: native alpha channel (or undecided/opaque) — draw as-is so
        // the source transparency is preserved exactly. ──
        const gl = glRef.current, cpu = cpuRef.current;
        if (gl) gl.style.opacity = "0";
        if (cpu) cpu.style.opacity = "1";
        const canvas = cpu;
        if (!canvas) return;
        if (canvas.width !== vw || canvas.height !== vh) { canvas.width = vw; canvas.height = vh; }
        const ctx = canvas.getContext("2d", { alpha: true });
        if (!ctx) return;
        ctx.clearRect(0, 0, vw, vh);
        ctx.drawImage(active, 0, 0, vw, vh);
        return;
      }

      // ── Path 2: older stacked AI matte ──
      {
        const gl = glRef.current, cpu = cpuRef.current;
        if (gl) gl.style.opacity = "0";
        if (cpu) cpu.style.opacity = "1";
        const canvas = cpu;
        if (!canvas) return;
        if (canvas.width !== vw || canvas.height !== vh) { canvas.width = vw; canvas.height = vh; }
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.clearRect(0, 0, vw, vh);
        try {
          ctx.drawImage(active, 0, vh, vw, vh, 0, 0, vw, vh);
          const matte = ctx.getImageData(0, 0, vw, vh).data;
          ctx.drawImage(active, 0, 0, vw, vh, 0, 0, vw, vh);
          const f = ctx.getImageData(0, 0, vw, vh);
          const d = f.data;
          for (let i = 0; i < d.length; i += 4) { const m = matte[i]; d[i + 3] = m < 10 ? 0 : m > 245 ? 255 : m; }
          ctx.putImageData(f, 0, 0);
        } catch { /* tainted */ }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); silenceAll(); };
  }, [ready, playKey, range?.start, range?.end]); // eslint-disable-line react-hooks/exhaustive-deps

  const layer: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "contain",
    objectPosition: "bottom",
  };

  return (
    <div
      className={className}
      style={{ position: "relative", width: "100%", height: "100%", opacity: visible ? 1 : 0, transition: "opacity 150ms" }}
    >
      <canvas ref={glRef} style={layer} />
      <canvas ref={cpuRef} style={{ ...layer, opacity: 0 }} />
    </div>
  );
};

export default FlowCharacter;
