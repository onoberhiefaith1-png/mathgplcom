import { useCallback, useEffect, useRef, useState } from "react";
import type { Segment } from "./types";

/**
 * Maps the non-destructive edit list onto a single <video> element:
 * timeline time -> source time, jumping across clip boundaries so trimmed
 * and deleted regions are never played.
 */
export function usePlayback(segments: Segment[], duration: number) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const segmentsRef = useRef(segments);
  const segIndexRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const [tlTime, setTlTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  segmentsRef.current = segments;

  const seek = useCallback((time: number) => {
    const segs = segmentsRef.current;
    const video = videoRef.current;
    if (segs.length === 0) return;
    const last = segs[segs.length - 1]!;
    const clamped = Math.min(Math.max(time, 0), last.tlEnd);
    let seg = segs.find((s) => clamped >= s.tlStart && clamped < s.tlEnd) ?? last;
    segIndexRef.current = seg.index;
    setTlTime(clamped);
    if (video) {
      video.currentTime = seg.clip.sourceStart + Math.min(clamped - seg.tlStart, seg.tlEnd - seg.tlStart);
    }
  }, []);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const segs = segmentsRef.current;
    if (!video || segs.length === 0) return;
    const seg = segs[Math.min(segIndexRef.current, segs.length - 1)]!;
    if (video.currentTime >= seg.clip.sourceEnd - 0.03) {
      const next = segs[seg.index + 1];
      if (next) {
        segIndexRef.current = next.index;
        video.currentTime = next.clip.sourceStart;
        setTlTime(next.tlStart);
      } else {
        video.pause();
        setPlaying(false);
        setTlTime(seg.tlEnd);
        return;
      }
    } else {
      setTlTime(seg.tlStart + (video.currentTime - seg.clip.sourceStart));
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playing, tick]);

  const play = useCallback(() => {
    const video = videoRef.current;
    const segs = segmentsRef.current;
    if (!video || segs.length === 0) return;
    const last = segs[segs.length - 1]!;
    if (video.currentTime >= last.clip.sourceEnd - 0.05 && segIndexRef.current === last.index) {
      const first = segs[0]!;
      segIndexRef.current = 0;
      video.currentTime = first.clip.sourceStart;
      setTlTime(0);
    }
    void video.play();
    setPlaying(true);
  }, []);

  const pause = useCallback(() => {
    videoRef.current?.pause();
    setPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (playing) pause();
    else play();
  }, [playing, play, pause]);

  // Edits can shorten the timeline under the playhead.
  useEffect(() => {
    if (tlTime > duration) seek(duration);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  return { videoRef, tlTime, playing, seek, play, pause, toggle };
}