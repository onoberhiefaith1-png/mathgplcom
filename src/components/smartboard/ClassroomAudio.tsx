import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { connectClassroomRelay } from "@/lib/classroomAudio/connectRelay";

type Connection = Awaited<ReturnType<typeof connectClassroomRelay>>;

export function ClassroomAudio({ classId, teacher }: { classId: string; teacher: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const connection = useRef<Connection | null>(null);
  const busy = useRef(false);
  const [ready, setReady] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const audio = container.current;
    if (!audio) return;
    const controller = new AbortController();
    setReady(false);
    setSpeaking(false);
    setMessage("");
    void connectClassroomRelay(async () => {
      const { data, error } = await supabase.functions.invoke("classroom-audio-token", {
        body: { classId },
      });
      if (error || typeof data?.url !== "string" || typeof data?.token !== "string") {
        throw new Error("Classroom audio is unavailable");
      }
      return { url: data.url, token: data.token };
    }, audio, controller.signal).then((connected) => {
      if (controller.signal.aborted) return connected.close();
      connection.current = connected;
      setReady(true);
    }).catch(() => {
      if (!controller.signal.aborted) setMessage("Classroom audio could not connect.");
    });
    return () => {
      connection.current = null;
      controller.abort();
    };
  }, [classId, attempt]);

  async function toggleMicrophone() {
    const current = connection.current;
    if (!current || busy.current) return;
    busy.current = true;
    try {
      await current.setMicrophone(!speaking);
      if (connection.current === current) setSpeaking(!speaking);
    } catch {
      if (connection.current === current) setMessage("Could not change microphone. Check browser permissions.");
    } finally {
      busy.current = false;
    }
  }

  return (
    <aside aria-label="Classroom audio" className="flex flex-wrap items-center gap-2 rounded-lg border bg-background p-2 text-sm">
      <div ref={container} />
      <span role="status">{message || (ready ? "Classroom audio connected" : "Connecting classroom audio…")}</span>
      {ready && (
        <button type="button" onClick={() => {
          void connection.current?.enableSound().catch(() => setMessage("The browser could not play classroom audio."));
        }}>Enable sound</button>
      )}
      {ready && teacher && (
        <button type="button" aria-pressed={speaking} onClick={() => void toggleMicrophone()}>
          {speaking ? "Mute microphone" : "Unmute microphone"}
        </button>
      )}
      {!ready && message && <button type="button" onClick={() => setAttempt((value) => value + 1)}>Retry audio</button>}
    </aside>
  );
}
