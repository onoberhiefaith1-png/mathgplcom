import { useEffect, useRef, useState } from "react";
import { AudioLines, CircleAlert, LoaderCircle, Mic, MicOff, Radio, RotateCcw, Settings2, ShieldCheck, ShieldMinus, UserRound, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

  const connected = phase === "connected";
  const connecting = phase === "connecting" || phase === "reconnecting";
  const microphoneAvailable = connected && (teacher || moderator || canPublish || !speaking);
  const microphoneLabel = speaking ? "Mute microphone" : "Unmute microphone";
  const ConnectionIcon = connecting ? LoaderCircle : connected ? AudioLines : CircleAlert;
  const shortStatus = connected ? "Connected" : phase === "reconnecting" ? "Reconnecting" : phase === "connecting" ? "Connecting" : phase === "offline" ? "Offline" : "Not connected";
  const actionClass = "h-9 w-full justify-start px-2 text-popover-foreground hover:bg-muted hover:text-popover-foreground";

  return (
    <aside aria-label="Classroom audio" className="dark fixed bottom-20 right-3 z-[200] flex items-center gap-1.5 rounded-full border border-border bg-popover p-1.5 text-popover-foreground shadow-lg">
      <div ref={container} />
      <span role="status" aria-live="polite" className="sr-only">{status}{microphoneNote ? ` ${microphoneNote}` : ""}</span>
      <Button type="button" size="icon" variant={speaking ? "default" : "secondary"}
        className="size-11 shrink-0 rounded-full" aria-label={microphoneLabel} title={microphoneLabel}
        aria-pressed={speaking} disabled={!microphoneAvailable}
        onClick={() => toggleMicrophone(permission === "blocked")}>
        {speaking ? <Mic aria-hidden="true" /> : <MicOff aria-hidden="true" />}
      </Button>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" size="icon" variant="ghost" className="size-9 rounded-full text-popover-foreground hover:bg-muted hover:text-popover-foreground"
            aria-label="Classroom audio settings" title="Classroom audio settings">
            <Settings2 aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" align="end" sideOffset={12} aria-label="Classroom audio settings"
          className="dark z-[201] max-h-[min(32rem,calc(100dvh-8rem))] w-64 max-w-[calc(100vw-1.5rem)] overflow-y-auto border-border bg-popover p-2 text-popover-foreground">
          <div className="flex items-center justify-between gap-2 border-b border-border px-2 pb-2 pt-1">
            <span className="text-sm font-semibold">Classroom audio</span>
            <span className="text-xs text-muted-foreground">{shortStatus}</span>
          </div>
          {(message || microphoneNote || (connected && quality === "constrained")) && (
            <p className="px-2 py-2 text-xs leading-relaxed text-muted-foreground">{status}{microphoneNote ? ` ${microphoneNote}` : ""}</p>
          )}
          <div className="flex flex-col gap-0.5 py-1">
            {connected && <>
              <Button type="button" variant="ghost" className={actionClass} aria-label="Enable sound" title="Enable sound" onClick={() => {
                void connection.current?.enableSound().catch(() => setMessage("The browser could not play classroom audio."));
              }}><Volume2 aria-hidden="true" />Enable sound</Button>
              {microphoneAvailable && <Button type="button" variant="ghost" className={actionClass}
                aria-label={speaking ? "Mute microphone" : teacher ? "Start smart classroom" : "Speak"}
                title={speaking ? "Mute microphone" : teacher ? "Start smart classroom" : "Speak"}
                onClick={() => toggleMicrophone(permission === "blocked")}>
                {speaking ? <MicOff aria-hidden="true" /> : <Radio aria-hidden="true" />}
                {speaking ? "Mute microphone" : teacher ? "Start classroom" : "Speak"}
              </Button>}
              {(teacher || moderator) && <>
                <div className="my-1 border-t border-border" />
                <label className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground" htmlFor={`audio-student-${classId}`}>
                  <UserRound className="size-4" aria-hidden="true" />Student
                </label>
                <select id={`audio-student-${classId}`} aria-label="Choose a student" title="Choose a student" value={selectedStudent}
                  className="mb-1 h-9 w-full min-w-0 rounded-md border border-border bg-muted px-2 text-sm text-popover-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onChange={(event) => setSelectedStudent(event.target.value)}>
                  <option value="">Choose a student</option>
                  {participants.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                </select>
                <Button type="button" variant="ghost" className={actionClass} disabled={!selectedStudent}
                  aria-label="Pass the microphone" title="Pass the microphone" onClick={() => void moderate("pass", selectedStudent)}><Mic aria-hidden="true" />Pass microphone</Button>
                <Button type="button" variant="ghost" className={actionClass} disabled={!selectedStudent}
                  aria-label="Mute student" title="Mute student" onClick={() => void moderate("mute", selectedStudent)}><MicOff aria-hidden="true" />Mute student</Button>
                <Button type="button" variant="ghost" className={actionClass}
                  aria-label="Mute students" title="Mute students" onClick={() => void moderate("mute-all")}><MicOff aria-hidden="true" />Mute all students</Button>
                <Button type="button" variant="ghost" className={actionClass}
                  aria-label="Unlock student microphones" title="Unlock student microphones" onClick={() => void moderate("allow-students")}><Mic aria-hidden="true" />Unlock microphones</Button>
                {teacher && <>
                  <div className="my-1 border-t border-border" />
                  <Button type="button" variant="ghost" className={actionClass} disabled={!selectedStudent}
                    aria-label="Make classroom audio admin" title="Make classroom audio admin" onClick={() => void moderate("appoint", selectedStudent)}><ShieldCheck aria-hidden="true" />Make audio admin</Button>
                  <Button type="button" variant="ghost" className={actionClass}
                    aria-label="Remove classroom audio admin" title="Remove classroom audio admin" onClick={() => void moderate("appoint")}><ShieldMinus aria-hidden="true" />Remove audio admin</Button>
                  <Button type="button" variant="ghost" className={actionClass}
                    aria-label="Restore audio" title="Restore audio" onClick={() => void moderate("reset")}><RotateCcw aria-hidden="true" />Restore audio</Button>
                </>}
              </>}
            </>}
            {!connected && !connecting && <Button type="button" variant="ghost" className={actionClass}
              aria-label="Retry audio" title="Retry audio" onClick={() => setAttempt((value) => value + 1)}><RotateCcw aria-hidden="true" />Reconnect</Button>}
          </div>
        </PopoverContent>
      </Popover>
      <span className={`mr-1 flex size-6 items-center justify-center ${connected && speaking ? "text-sidebar-primary" : message || !connected && !connecting ? "text-destructive" : "text-muted-foreground"}`}
        role="img" aria-label={connected ? speaking ? "Microphone active" : "Microphone muted" : shortStatus}
        title={connected ? speaking ? "Microphone active" : "Microphone muted" : status}>
        <ConnectionIcon aria-hidden="true" className={`size-4 ${connecting ? "motion-safe:animate-spin" : ""}`} />
      </span>
    </aside>
  );
}
