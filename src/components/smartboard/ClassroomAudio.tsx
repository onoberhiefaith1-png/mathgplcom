import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { connectClassroomRelay } from "@/lib/classroomAudio/connectRelay";
import { requestClassroomAudio } from "@/lib/classroomAudio/request";

type Connection = Awaited<ReturnType<typeof connectClassroomRelay>>;

export function ClassroomAudio({ classId, teacher }: { classId: string; teacher: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const connection = useRef<Connection | null>(null);
  const busy = useRef(false);
  const [ready, setReady] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [participants, setParticipants] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedStudent, setSelectedStudent] = useState("");

  useEffect(() => {
    const audio = container.current;
    if (!audio) return;
    const controller = new AbortController();
    setReady(false);
    setSpeaking(false);
    setMessage("");
    void connectClassroomRelay(async () => {
      const data = await requestClassroomAudio("token", { classId });
      if (typeof data?.url !== "string" || typeof data?.token !== "string") {
        throw new Error("Classroom audio is unavailable");
      }
      return { url: data.url, token: data.token };
    }, audio, controller.signal, (state) => {
      if (controller.signal.aborted) return;
      setReady(state.connected);
      setSpeaking(state.microphoneEnabled);
      setParticipants(state.participants);
    }).then((connected) => {
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
      if (!teacher) {
        if (speaking) await current.setMicrophone(false);
        const data = await requestClassroomAudio("control", {
          classId, command: speaking ? "release" : "request",
        });
        const { data: identity } = await supabase.auth.getUser();
        if (!speaking && data?.speakerId !== identity.user?.id) {
          setMessage("Another student has the microphone.");
          return;
        }
      }
      await current.setMicrophone(!speaking);
      if (connection.current === current) setSpeaking(!speaking);
    } catch {
      if (connection.current === current) setMessage("Could not change microphone. Check browser permissions.");
    } finally {
      busy.current = false;
    }
  }

  async function moderate(command: string, studentId?: string) {
    if (busy.current) return;
    busy.current = true;
    try {
      await requestClassroomAudio("control", { classId, command, studentId });
      setMessage("");
    } catch {
      setMessage("Microphone control failed. Retry or restore classroom audio.");
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
        <>
          <select aria-label="Student microphone" value={selectedStudent}
            onChange={(event) => setSelectedStudent(event.target.value)}>
            <option value="">Choose a student</option>
            {participants.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
          <button type="button" disabled={!selectedStudent}
            onClick={() => void moderate("pass", selectedStudent)}>Pass the microphone</button>
          <button type="button" onClick={() => void moderate("mute-all")}>Mute students</button>
          <button type="button" onClick={() => void moderate("allow-students")}>Allow student microphones</button>
        </>
      )}
      {ready && (
        <button type="button" aria-pressed={speaking} onClick={() => void toggleMicrophone()}>
          {speaking ? "Mute microphone" : "Unmute microphone"}
        </button>
      )}
      {!ready && message && <button type="button" onClick={() => setAttempt((value) => value + 1)}>Retry audio</button>}
    </aside>
  );
}
