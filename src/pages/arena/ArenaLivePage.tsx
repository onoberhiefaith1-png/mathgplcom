// Read-only live championship display; evaluation and submission stay in the existing engine.
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { fetchArenaBoard, type ArenaBoard } from "@/lib/arena/arenaClient";
import { acceptBoard, changedChampions, pollDelayMs } from "@/lib/arena/liveBoard";
import { ChampionsArena } from "@/components/arena/ChampionsArena";

const ArenaLivePage = () => {
  const { code } = useParams({ from: "/arena/live/$code" });
  const [board, setBoard] = useState<ArenaBoard | null>(null);
  const [missing, setMissing] = useState(false);
  const [realtime, setRealtime] = useState(false);
  const [failures, setFailures] = useState(0);
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const prev = useRef<ArenaBoard | null>(null);
  const inflight = useRef(false);
  const again = useRef(false);
  const load = useCallback(async () => {
    // One request at a time; a nudge that arrives mid-flight triggers one more read after it.
    if (inflight.current) { again.current = true; return; }
    inflight.current = true;
    try {
      const incoming = await fetchArenaBoard(code.toUpperCase());
      const next = acceptBoard(prev.current, incoming);
      if (next === incoming) {
        const changed = changedChampions(prev.current, incoming);
        if (changed.size) { setFlash(changed); window.setTimeout(() => setFlash(new Set()), 1700); }
        prev.current = incoming;
        setBoard(incoming);
      }
      setFailures(0);
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


  // Realtime nudges (join / start / new best) re-read immediately.
  const shareId = board?.shareId;
  useEffect(() => {
    if (!shareId) return;
    let timer: number | undefined;
    const channel = supabase
      .channel(`arena:${shareId}`)
      .on("broadcast", { event: "update" }, () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => void load(), 200);
      })
      .subscribe((status) => {
        setRealtime(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") void load();
      });
    return () => { window.clearTimeout(timer); void supabase.removeChannel(channel); };
  }, [shareId, load]);

  if (missing) return <main className="champions-arena ca-no-questions">This display link is not valid.</main>;
  if (!board) return <main className="champions-arena ca-no-questions" role="status">Loading Champions Arena…</main>;
  return <ChampionsArena board={board} flash={flash} status={failures > 0 ? "RECONNECTING" : realtime ? "LIVE" : "LIVE · POLLING"} />;
};

export default ArenaLivePage;
