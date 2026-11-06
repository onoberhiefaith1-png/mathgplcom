import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { connectClassroomRelay } from "@/lib/classroomAudio/connectRelay";
import { ClassroomAudioError, requestClassroomAudio } from "@/lib/classroomAudio/request";
import { captureMicrophone, stopMicrophoneStream } from "@/lib/classroomAudio/permission";
import {
  AUDIO_CONNECTION_NOT_SET,
  classifyMicrophoneFailure,
  connectAction,
  audioErrorInput,
  diagnoseAudioError,
  permissionFromQuery,
  planMicrophoneRequest,
  retryDelayMs,
  type AudioPhase,
  type MicrophonePermission,
} from "@/lib/classroomAudio/diagnosis";
import type { SpeechQuality } from "@/lib/classroomAudio/quality";

type Connection = Awaited<ReturnType<typeof connectClassroomRelay>>;

export function ClassroomAudio({ classId, teacher }: { classId: string; teacher: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const connection = useRef<Connection | null>(null);
  const busy = useRef(false);
  const [phase, setPhase] = useState<AudioPhase>("connecting");
  const [speaking, setSpeaking] = useState(false);
  const [message, setMessage] = useState("");
  const [microphoneNote, setMicrophoneNote] = useState("");
  const [permission, setPermission] = useState<MicrophonePermission>("unknown");
  const [attempt, setAttempt] = useState(0);
  const [participants, setParticipants] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [moderator, setModerator] = useState(false);
  const [canPublish, setCanPublish] = useState(false);
  const [quality, setQuality] = useState<SpeechQuality>("clear");
  const recoveryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const audio = container.current;
    if (!audio) return;
    if (connectAction(typeof navigator === "undefined" || navigator.onLine) === "wait") {
      setPhase("offline");
      setMessage("You are offline. Classroom audio will reconnect when the internet returns.");
      setMicrophoneNote("The microphone was not requested.");
      const retryWhenOnline = () => setAttempt((value) => value + 1);
      window.addEventListener("online", retryWhenOnline);
      return () => window.removeEventListener("online", retryWhenOnline);
    }
    const controller = new AbortController();
    let stoppingMic = false;
    let sawConnected = false;
    setPhase("connecting");
    setSpeaking(false);
    setMessage("");
    setMicrophoneNote("");
    void connectClassroomRelay(async () => {
      const data = await requestClassroomAudio("token", { classId });
      if (typeof data?.url !== "string" || typeof data?.token !== "string") {
        throw new ClassroomAudioError("Audio not connected", "not_connected");
      }
      return { url: data.url, token: data.token };
    }, audio, controller.signal, (state) => {
      if (controller.signal.aborted) return;
      const reconnecting = state.connectionState === "reconnecting" || state.connectionState === "signalReconnecting";
      if (state.connected) {
        sawConnected = true;
        setPhase("connected");
      } else if (reconnecting) setPhase("reconnecting");
      else if (sawConnected && state.connectionState === "disconnected" && !recoveryTimer.current) {
        setPhase("not_connected");
        setMessage("Audio not connected");
        setMicrophoneNote("The microphone was not requested.");
        recoveryTimer.current = setTimeout(() => {
          recoveryTimer.current = undefined;
          if (!controller.signal.aborted) setAttempt((value) => value + 1);
        }, retryDelayMs(attempt));
      }
      setSpeaking(state.microphoneEnabled);
      setCanPublish(state.canPublish);
      setParticipants(state.participants);
      setModerator(state.moderator);
      setQuality(state.quality);
      if (!state.canPublish && state.microphoneEnabled && !stoppingMic) {
        stoppingMic = true;
        void connection.current?.stopMicrophone().finally(() => {
          stoppingMic = false;
        });
      }
    }).then((connected) => {
      if (controller.signal.aborted) return connected.close();
      connection.current = connected;
      setPhase("connected");
      setMessage("");
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      const diagnosed = diagnoseAudioError(
        audioErrorInput(error),
        typeof navigator === "undefined" || navigator.onLine,
      );
      setPhase(diagnosed.phase);
      setMessage(diagnosed.message);
      setMicrophoneNote(diagnosed.microphone);
      if (!diagnosed.retry) return;
      recoveryTimer.current = setTimeout(() => {
        recoveryTimer.current = undefined;
        if (!controller.signal.aborted) setAttempt((value) => value + 1);
      }, retryDelayMs(attempt));
    });
    const retryWhenOnline = () => {
      if (!controller.signal.aborted) setAttempt((value) => value + 1);
    };
    window.addEventListener("online", retryWhenOnline);
    return () => {
      connection.current = null;
      clearTimeout(recoveryTimer.current);
      recoveryTimer.current = undefined;
      window.removeEventListener("online", retryWhenOnline);
      controller.abort();
    };
  }, [classId, attempt]);

  useEffect(() => {
    if (phase !== "connected" || typeof navigator === "undefined" || !navigator.permissions?.query) return;
    let cancel = false;
    void navigator.permissions.query({ name: "microphone" as PermissionName }).then((status) => {
      if (!cancel) setPermission(permissionFromQuery(status.state));
    }).catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [phase]);

  useEffect(() => {
    if (teacher || moderator || !speaking) return;
    const timer = setInterval(() => {
      void requestClassroomAudio("control", { classId, command: "renew" }).catch(() => undefined);
    }, 10_000);
    return () => clearInterval(timer);
  }, [classId, speaking, teacher, moderator]);

  async function finishSpeaking(current: Connection, capture: Promise<MediaStream>, want: boolean) {
    let stream: MediaStream | null = null;
    try {
      if (!want) {
        await current.stopMicrophone();
        if (connection.current === current) setSpeaking(false);
        return;
      }
      stream = await capture;
      setPermission("granted");
      if (!teacher && !moderator) {
        const data = await requestClassroomAudio("control", { classId, command: "request" });
        const { data: identity } = await supabase.auth.getUser();
        if (data?.speakerId !== identity.user?.id) {
          stopMicrophoneStream(stream);
          setMessage(data?.studentsMuted
            ? "Your teacher has muted student microphones."
            : "Another student has the microphone.");
          return;
        }
      }
      await current.waitUntilCanPublish();
      await current.publishMicrophone(stream);
      if (connection.current === current) {
        setSpeaking(true);
        setMessage("");
      }
    } catch (error) {
      stopMicrophoneStream(stream);
      if (connection.current !== current) return;
      const name = error instanceof DOMException || error instanceof Error ? error.name : "";
      const kind = classifyMicrophoneFailure(name);
      if (kind === "blocked" || kind === "missing") {
        setPermission(kind);
        setMessage(kind === "blocked"
          ? "The browser has blocked the microphone for this site. Allow the microphone in the browser's site settings, then try again. The browser will not show the permission prompt again until that changes."
          : "This browser has no microphone this page can use.");
        return;
      }
      setMessage(error instanceof ClassroomAudioError ? error.message : "Could not change microphone.");
    }
  }

  function toggleMicrophone(force = false) {
    const current = connection.current;
    if (!current || busy.current) return;
    const plan = planMicrophoneRequest({ phase, permission });
    if (!force && !plan.request) {
      setMessage(plan.message);
      return;
    }
    if (!force && speaking) {
      busy.current = true;
      void (async () => {
        try {
          if (!teacher && !moderator) {
            await requestClassroomAudio("control", { classId, command: "release" });
          }
          await current.stopMicrophone();
          if (connection.current === current) setSpeaking(false);
        } catch (error) {
          if (connection.current === current) {
            setMessage(error instanceof ClassroomAudioError ? error.message : "Could not change microphone.");
          }
        } finally {
          busy.current = false;
        }
      })();
      return;
    }
    // Start the permission request in this click, before any await.
    const capture = captureMicrophone();
    void current.enableSound().catch(() => setMessage("The browser could not play classroom audio."));
    busy.current = true;
    void finishSpeaking(current, capture, true).finally(() => {
      busy.current = false;
    });
  }

  async function moderate(command: string, studentId?: string) {
    if (busy.current) return;
    busy.current = true;
    try {
      await requestClassroomAudio("control", { classId, command, studentId });
      setMessage("");
      if (command === "reset") setAttempt((value) => value + 1);
    } catch (error) {
      setMessage(error instanceof ClassroomAudioError ? error.message : "Microphone control failed. Retry or restore classroom audio.");
    } finally {
      busy.current = false;
    }
  }

  const status = message || (
    phase === "connected"
      ? quality === "constrained"
        ? "Classroom audio connected. Quality is reduced on a weak connection."
        : "Classroom audio connected"
      : phase === "reconnecting"
        ? "Reconnecting classroom audio…"
        : phase === "offline"
          ? "You are offline. Classroom audio will reconnect when the internet returns."
          : phase === "connection_not_set"
            ? AUDIO_CONNECTION_NOT_SET
            : phase === "not_connected"
              ? "Audio not connected"
              : "Connecting classroom audio…"
  );

  return (
    <aside aria-label="Classroom audio" className="fixed bottom-20 right-3 z-[200] flex max-w-sm flex-wrap items-center gap-2 rounded-lg border bg-background p-2 text-sm shadow-lg">
      <div ref={container} />
      <span role="status">{status}{microphoneNote ? ` ${microphoneNote}` : ""}</span>
      {phase === "connected" && (
        <button type="button" onClick={() => {
          void connection.current?.enableSound().catch(() => setMessage("The browser could not play classroom audio."));
        }}>Enable sound</button>
      )}
      {phase === "connected" && (teacher || moderator) && (
        <>
          <select aria-label="Student microphone" value={selectedStudent}
            onChange={(event) => setSelectedStudent(event.target.value)}>
            <option value="">Choose a student</option>
            {participants.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
          <button type="button" disabled={!selectedStudent}
            onClick={() => void moderate("pass", selectedStudent)}>Pass the microphone</button>
          <button type="button" disabled={!selectedStudent}
            onClick={() => void moderate("mute", selectedStudent)}>Mute student</button>
          <button type="button" onClick={() => void moderate("mute-all")}>Mute students</button>
          <button type="button" onClick={() => void moderate("allow-students")}>Allow student microphones</button>
          {teacher && <>
            <button type="button" disabled={!selectedStudent}
              onClick={() => void moderate("appoint", selectedStudent)}>Make classroom audio admin</button>
            <button type="button" onClick={() => void moderate("appoint")}>Remove classroom audio admin</button>
            <button type="button" onClick={() => void moderate("reset")}>Restore audio</button>
          </>}
        </>
      )}
      {phase === "connected" && (teacher || moderator || canPublish || !speaking) && (
        <button type="button" aria-pressed={speaking} onClick={() => toggleMicrophone(permission === "blocked")}>
          {speaking ? "Mute microphone" : teacher ? "Start classroom audio" : "Speak"}
        </button>
      )}
      {phase !== "connected" && phase !== "connecting" && phase !== "reconnecting" && (
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>Retry audio</button>
      )}
    </aside>
  );
}
