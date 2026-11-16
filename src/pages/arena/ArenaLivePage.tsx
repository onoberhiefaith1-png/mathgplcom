// Read-only live championship display; evaluation and submission stay in the existing engine.
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { fetchArenaBoard, type ArenaBoard } from "@/lib/arena/arenaClient";
import {
  acceptBoard, changedChampions, pollDelayMs, resolvePalette, resolveTheme, resubscribeDelayMs,
  PALETTE_KEY, THEME_KEY, type ReportPalette, type ReportTheme,
} from "@/lib/arena/liveBoard";

const readSaved = (key: string): string | null => { try { return localStorage.getItem(key); } catch { return null; } };
/** The Mathemagine app's own choice: saved theme, then the signed-in app theme, then the device. */
const initialTheme = (): ReportTheme => resolveTheme(
  readSaved(THEME_KEY),
  typeof document !== "undefined" ? document.documentElement.dataset["appTheme"] : null,
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches,
);
import { ChampionsArena } from "@/components/arena/ChampionsArena";
import { demoArenaBoard, isDemoArenaCode } from "@/lib/arena/demoBoard";

const ArenaLivePage = () => {
  const { code } = useParams({ from: "/arena/live/$code" });
  const [board, setBoard] = useState<ArenaBoard | null>(null);
  const [missing, setMissing] = useState(false);
  const [realtime, setRealtime] = useState(false);
  const [failures, setFailures] = useState(0);
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [theme, setTheme] = useState<ReportTheme>(initialTheme);
  const [palette] = useState<ReportPalette>(() => resolvePalette(readSaved(PALETTE_KEY)));
  const toggleTheme = () => setTheme((t) => {
    const next = t === "dark" ? "light" : "dark";
    try { localStorage.setItem(THEME_KEY, next); } catch { /* private mode */ }
    return next;
  });
  const prev = useRef<ArenaBoard | null>(null);
  const inflight = useRef(false);
  const again = useRef(false);
  const load = useCallback(async () => {
    // One request at a time; a nudge that arrives mid-flight triggers one more read after it.
    if (inflight.current) { again.current = true; return; }
    inflight.current = true;
    try {
      const incoming = isDemoArenaCode(code) ? demoArenaBoard() : await fetchArenaBoard(code.toUpperCase());
      const next = acceptBoard(prev.current, incoming);
      if (next === incoming) {
        const changed = changedChampions(prev.current, incoming);
        if (changed.size) { setFlash(changed); window.setTimeout(() => setFlash(new Set()), 1700); }
        prev.current = incoming;
        setBoard(incoming);
      }
      setFailures(0);
      setUpdatedAt(Date.now());
    } catch (e) {
      const notFound = (e as Error).message === "not_found";
      if (!prev.current && notFound) setMissing(true);
      setFailures((f) => f + 1);
    } finally {
      inflight.current = false;
      if (again.current) { again.current = false; void load(); }
    }
  }, [code]);

  // Poll steadily — this is what keeps the report right even if realtime is blocked on the school network.
  const pollRef = useRef({ realtime, failures });
  pollRef.current = { realtime, failures };
  useEffect(() => {
    let timer: number | undefined;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      void load();
      timer = window.setTimeout(tick, pollDelayMs({ ...pollRef.current, hidden: document.visibilityState === "hidden" }));
    };
    tick();
    const onVisible = () => { if (document.visibilityState === "visible") { window.clearTimeout(timer); tick(); } };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => { stopped = true; window.clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("online", onVisible); };
  }, [load]);


  // Realtime nudges (join / start / new best) re-read immediately. A dropped
  // channel (school wifi, laptop asleep, server restart) is rejoined with
  // backoff instead of being left dead; polling covers the gap meanwhile.
  const shareId = board?.shareId;
  useEffect(() => {
    if (!shareId) return;
    let timer: number | undefined;
    let retry: number | undefined;
    let attempt = 0;
    let stopped = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const join = () => {
      if (stopped) return;
      const ch = supabase
        .channel(`arena:${shareId}`)
        .on("broadcast", { event: "update" }, () => {
          window.clearTimeout(timer);
          timer = window.setTimeout(() => void load(), 200);
        });
      channel = ch;
      ch.subscribe((status) => {
          // Only the current channel may report; a removed one closing is expected.
          if (stopped || ch !== channel) return;
          setRealtime(status === "SUBSCRIBED");
          if (status === "SUBSCRIBED") { attempt = 0; void load(); return; }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            const dead = channel;
            channel = null;
            if (dead) void supabase.removeChannel(dead);
            window.clearTimeout(retry);
            retry = window.setTimeout(join, resubscribeDelayMs(attempt++));
          }
        });
    };
    join();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      window.clearTimeout(retry);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [shareId, load]);

  const shell = `champions-arena mm-app ${theme === "dark" ? "mm-dark ca-dark" : "mm-light ca-light"} mm-palette-${palette} ca-no-questions`;
  if (missing) return <main className={shell}>This display link is not valid.</main>;
  if (!board) return <main className={shell} role="status">Loading Champions Arena…</main>;
  return <ChampionsArena board={board} flash={flash} theme={theme} palette={palette} onToggleTheme={toggleTheme} updatedAt={updatedAt}
    status={failures > 0 ? "RECONNECTING" : realtime ? "LIVE" : "LIVE · POLLING"} />;
};

export default ArenaLivePage;
