import { useEffect, useRef, useState } from "react";
import {
  AudioLines, CircleAlert, Headphones, LoaderCircle, LogOut, Mic, MicOff, Radio, RotateCcw, Settings2,
  ShieldCheck, ShieldMinus, UserRound, Volume2, WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { connectClassroomRelay } from "@/lib/classroomAudio/connectRelay";
import { ClassroomAudioError, requestClassroomAudio } from "@/lib/classroomAudio/request";
import { captureMicrophone, stopMicrophoneStream } from "@/lib/classroomAudio/permission";
import {
  audioErrorInput,
  classifyMicrophoneFailure,
  permissionFromQuery,
  planMicrophoneRequest,
  retryDelayMs,
  type MicrophonePermission,
} from "@/lib/classroomAudio/diagnosis";
import {
  friendlyAudioError,
  joinStatusLabel,
  microphoneHelpSteps,
  permissionBrowserFor,
  type JoinMode,
  type JoinPhase,
} from "@/lib/classroomAudio/joinFlow";
import type { SpeechQuality } from "@/lib/classroomAudio/quality";

type Connection = Awaited<ReturnType<typeof connectClassroomRelay>>;
type Problem = { title: string; detail: string; technical: string };

/**
 * Classroom audio, joined like a Meet or Zoom call: nothing connects and the
 * microphone is not asked for until the person taps Join. "Join with
 * microphone" asks the browser first (the prompt starts inside the tap), then
 * connects; "Listen only" connects without a microphone (view-only students).
 */
export function ClassroomAudio({ classId, teacher }: { classId: string; teacher: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const connection = useRef<Connection | null>(null);
  const busy = useRef(false);
  /** Teacher's stream from the Join tap, published as soon as the room connects. */
  const pendingStream = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<JoinPhase>("idle");
  const [mode, setMode] = useState<JoinMode | null>(null);
  const [open, setOpen] = useState(false);
  const [join, setJoin] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [message, setMessage] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [permission, setPermission] = useState<MicrophonePermission>("unknown");
  const [participants, setParticipants] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [moderator, setModerator] = useState(false);
  const [canPublish, setCanPublish] = useState(false);
  const [quality, setQuality] = useState<SpeechQuality>("clear");
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [ua, setUa] = useState("");
  const [touchPoints, setTouchPoints] = useState(0);
  const recoveryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setUa(navigator.userAgent);
    setTouchPoints(navigator.maxTouchPoints ?? 0);
  }, []);

  // Connect only after a Join tap (join > 0); attempt > 0 reconnects the same way.
  useEffect(() => {
    const audio = container.current;
    if (!audio || join === 0) return;
    const online = typeof navigator === "undefined" || navigator.onLine;
    if (!online) {
      const failure = friendlyAudioError(null, false);
      setPhase("offline");
      setProblem(failure);
      const retryWhenOnline = () => setAttempt((value) => value + 1);
      window.addEventListener("online", retryWhenOnline);
      return () => window.removeEventListener("online", retryWhenOnline);
    }
    const controller = new AbortController();
    let stoppingMic = false;
    let sawConnected = false;
    setPhase((current) => (current === "connected" || current === "reconnecting" ? "reconnecting" : "connecting"));
    setSpeaking(false);
    setProblem(null);
    setMessage("");
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
        setPhase("reconnecting");
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
      setPlaybackBlocked(state.audioPlaybackBlocked);
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
      void connected.enableSound().catch(() => setPlaybackBlocked(true));
      // The teacher joined with the microphone: start speaking straight away.
      const stream = pendingStream.current;
      pendingStream.current = null;
      if (stream) {
        busy.current = true;
        void finishSpeaking(connected, Promise.resolve(stream), true).finally(() => {
          busy.current = false;
        });
      }
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      stopMicrophoneStream(pendingStream.current);
      pendingStream.current = null;
      const failure = friendlyAudioError(audioErrorInput(error), typeof navigator === "undefined" || navigator.onLine);
      setPhase(failure.phase);
      setProblem(failure);
      setOpen(true);
      if (!failure.retry) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, join, attempt]);

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

  /** Join tap. With the microphone, the browser prompt starts here, inside the tap. */
  function joinAudio(next: JoinMode) {
    if (busy.current) return;
    setMode(next);
    setProblem(null);
    setMessage("");
    if (next === "listen") {
      setJoin((value) => value + 1);
      return;
    }
    const capture = captureMicrophone();
    setPhase("requesting");
    busy.current = true;
    capture.then((stream) => {
      setPermission("granted");
      // Students hold the microphone only when they ask to speak; the teacher speaks at once.
      if (teacher) pendingStream.current = stream;
      else stopMicrophoneStream(stream);
      setJoin((value) => value + 1);
    }, (error: unknown) => {
      const name = error instanceof DOMException || error instanceof Error ? error.name : "";
      const kind = classifyMicrophoneFailure(name);
      setPermission(kind === "failed" ? "unknown" : kind);
      setPhase(kind === "blocked" ? "denied" : kind === "missing" ? "no_mic" : "error");
      if (kind === "failed") {
        setProblem({ title: "The microphone couldn't start", detail: "Another app may be using it. Close other call apps, then try again, or join with Listen only.", technical: name });
      }
      setOpen(true);
    }).finally(() => {
      busy.current = false;
    });
  }

  function leaveAudio() {
    stopMicrophoneStream(pendingStream.current);
    pendingStream.current = null;
    connection.current?.close();
    connection.current = null;
    clearTimeout(recoveryTimer.current);
    recoveryTimer.current = undefined;
    setJoin(0);
    setPhase("idle");
    setMode(null);
    setSpeaking(false);
    setProblem(null);
    setMessage("");
    setParticipants([]);
  }

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
            : "Another student is speaking. Try again when they finish.");
          return;
        }
      }
      await current.waitUntilCanPublish();
      await current.publishMicrophone(stream);
      if (connection.current === current) {
        setSpeaking(true);
        setMessage("");
        setMode("mic");
      }
    } catch (error) {
      stopMicrophoneStream(stream);
      if (connection.current !== current) return;
      const name = error instanceof DOMException || error instanceof Error ? error.name : "";
      const kind = classifyMicrophoneFailure(name);
      if (kind === "blocked" || kind === "missing") {
        setPermission(kind);
        setMessage(kind === "blocked"
          ? "Your browser is blocking the microphone for this site. See below for how to allow it."
          : "No microphone was found on this device.");
        setOpen(true);
        return;
      }
      setMessage(error instanceof ClassroomAudioError ? friendlyAudioError(audioErrorInput(error), true).title : "Couldn't turn the microphone on. Try again.");
    }
  }

  function toggleMicrophone() {
    const current = connection.current;
    if (!current || busy.current) return;
    if (speaking) {
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
            setMessage(error instanceof ClassroomAudioError ? friendlyAudioError(audioErrorInput(error), true).title : "Couldn't turn the microphone off. Try again.");
          }
        } finally {
          busy.current = false;
        }
      })();
      return;
    }
    const plan = planMicrophoneRequest({ phase: "connected", permission: permission === "blocked" ? "unknown" : permission });
    if (!plan.request) {
      setMessage(plan.message);
      return;
    }
    // Start the permission request in this tap, before any await (a blocked
    // microphone is asked again too: the browser answers at once if still blocked).
    const capture = captureMicrophone();
    void current.enableSound().catch(() => setPlaybackBlocked(true));
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
      setMessage(error instanceof ClassroomAudioError ? friendlyAudioError(audioErrorInput(error), true).title : "Microphone control failed. Try again.");
    } finally {
      busy.current = false;
    }
  }

  const connected = phase === "connected";
  const working = phase === "requesting" || phase === "connecting" || phase === "reconnecting";
  const failed = phase === "denied" || phase === "no_mic" || phase === "offline" || phase === "not_set" || phase === "error";
  const label = joinStatusLabel(phase, speaking);
  const microphoneAvailable = connected && (teacher || moderator || canPublish || !speaking);
  const microphoneLabel = speaking ? "Mute microphone" : "Unmute microphone";
  const helpSteps = microphoneHelpSteps(permissionBrowserFor(ua, touchPoints));
  const roomCount = participants.length + 1;
  const actionClass = "h-10 w-full justify-start px-2 text-popover-foreground hover:bg-muted hover:text-popover-foreground";
  const StatusIcon = working ? LoaderCircle : connected ? AudioLines : phase === "offline" ? WifiOff : failed ? CircleAlert : Headphones;
  const statusText = problem
    ? `${problem.title}. ${problem.detail}`
    : message || (connected ? (quality === "constrained" ? "Connected. Quality is reduced on a weak connection." : "Connected to classroom audio.") : label);

  const primary = "h-11 w-full justify-center gap-2 rounded-full font-semibold";
  const joinButtons = (
    <div className="flex flex-col gap-2 px-2 pb-2">
      <Button type="button" className={primary} data-testid="audio-join-mic" onClick={() => joinAudio("mic")}>
        <Mic aria-hidden="true" />{teacher ? "Join and start speaking" : "Join with microphone"}
      </Button>
      <Button type="button" variant="secondary" className={primary} data-testid="audio-join-listen" onClick={() => joinAudio("listen")}>
        <Headphones aria-hidden="true" />Listen only
      </Button>
    </div>
  );

  return (
    <aside aria-label="Classroom audio" data-audio-phase={phase} className="dark fixed bottom-20 right-3 z-[200] flex items-center gap-1.5 rounded-full border border-border bg-popover p-1.5 text-popover-foreground shadow-lg">
      <div ref={container} />
      <span role="status" aria-live="polite" className="sr-only">{statusText}</span>
      {connected && (
        <Button type="button" size="icon" variant={speaking ? "default" : "secondary"}
          className="size-11 shrink-0 rounded-full" aria-label={microphoneLabel} title={microphoneLabel}
          aria-pressed={speaking} disabled={!microphoneAvailable} data-testid="audio-mic"
          onClick={() => toggleMicrophone()}>
          {speaking ? <Mic aria-hidden="true" /> : <MicOff aria-hidden="true" />}
        </Button>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {connected ? (
            <Button type="button" size="icon" variant="ghost" className="size-9 rounded-full text-popover-foreground hover:bg-muted hover:text-popover-foreground"
              aria-label="Classroom audio settings" title="Classroom audio settings" data-testid="audio-settings">
              <Settings2 aria-hidden="true" />
            </Button>
          ) : (
            <Button type="button" variant={phase === "idle" ? "default" : "ghost"} data-testid="audio-pill"
              className={`h-11 gap-2 rounded-full px-4 font-semibold ${phase === "idle" ? "" : failed ? "text-destructive hover:bg-muted" : "text-popover-foreground hover:bg-muted"}`}
              aria-label={`Classroom audio: ${label}`} title={statusText}>
              <StatusIcon aria-hidden="true" className={`size-5 ${working ? "motion-safe:animate-spin" : ""}`} />
              <span>{label}</span>
            </Button>
          )}
        </PopoverTrigger>
        <PopoverContent side="top" align="end" sideOffset={12} aria-label="Classroom audio"
          className="dark z-[201] max-h-[min(34rem,calc(100dvh-8rem))] w-72 max-w-[calc(100vw-1.5rem)] overflow-y-auto border-border bg-popover p-2 text-popover-foreground">
          <div className="flex items-center justify-between gap-2 border-b border-border px-2 pb-2 pt-1">
            <span className="text-sm font-semibold">Classroom audio</span>
            <span data-testid="audio-status" className={`flex items-center gap-1.5 text-xs ${connected ? "text-emerald-400" : failed ? "text-destructive" : "text-muted-foreground"}`}>
              {connected && <span className="size-2 rounded-full bg-emerald-400" aria-hidden="true" />}
              {working && <LoaderCircle className="size-3 motion-safe:animate-spin" aria-hidden="true" />}
              {connected ? (mode === "listen" && !speaking ? "Connected · listening" : "Connected") : label}
            </span>
          </div>

          {phase === "idle" && <>
            <p className="px-2 py-3 text-sm leading-relaxed text-muted-foreground">
              {teacher
                ? "Your browser will ask to use your microphone. Choose Allow, and your class will hear you."
                : "Join to hear your teacher. With the microphone, your browser will ask for permission first; choose Allow. You can also just listen."}
            </p>
            {joinButtons}
          </>}

          {phase === "requesting" && (
            <div className="px-2 py-3 text-sm leading-relaxed" data-testid="audio-requesting">
              <p className="font-medium">Waiting for microphone permission</p>
              <p className="mt-1 text-muted-foreground">Look for the browser's question near the address bar (on iPhone and iPad it pops up in the middle of the screen) and choose <strong>Allow</strong>.</p>
            </div>
          )}

          {(phase === "connecting" || phase === "reconnecting") && (
            <div className="flex items-center gap-2 px-2 py-3 text-sm" data-testid="audio-connecting">
              <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />
              {phase === "reconnecting" ? "Connection dropped. Reconnecting…" : mode === "mic" ? "Microphone allowed. Connecting to the class…" : "Connecting to the class…"}
            </div>
          )}

          {phase === "denied" && (
            <div className="px-2 py-2 text-sm leading-relaxed" data-testid="audio-denied">
              <p className="font-medium text-destructive">Microphone blocked</p>
              <p className="mt-1 text-muted-foreground">Your browser is not letting this site use the microphone. To allow it:</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
                {helpSteps.map((step) => <li key={step}>{step}</li>)}
              </ol>
              <div className="mt-3 flex flex-col gap-2">
                <Button type="button" className={primary} onClick={() => joinAudio("mic")}><RotateCcw aria-hidden="true" />Try again</Button>
                <Button type="button" variant="secondary" className={primary} onClick={() => joinAudio("listen")}><Headphones aria-hidden="true" />Listen only</Button>
              </div>
            </div>
          )}

          {phase === "no_mic" && (
            <div className="px-2 py-2 text-sm leading-relaxed" data-testid="audio-no-mic">
              <p className="font-medium text-destructive">No microphone found</p>
              <p className="mt-1 text-muted-foreground">Plug in or turn on a microphone or headset, then try again. You can still listen.</p>
              <div className="mt-3 flex flex-col gap-2">
                <Button type="button" className={primary} onClick={() => joinAudio("mic")}><RotateCcw aria-hidden="true" />Try again</Button>
                <Button type="button" variant="secondary" className={primary} onClick={() => joinAudio("listen")}><Headphones aria-hidden="true" />Listen only</Button>
              </div>
            </div>
          )}

          {(phase === "error" || phase === "offline" || phase === "not_set") && problem && (
            <div className="px-2 py-2 text-sm leading-relaxed" data-testid="audio-error">
              <p className="font-medium text-destructive">{problem.title}</p>
              <p className="mt-1 text-muted-foreground">{problem.detail}</p>
              {problem.technical && (
                <details className="mt-2 text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Technical details</summary>
                  <p className="mt-1 break-words font-mono">{problem.technical}</p>
                </details>
              )}
              <div className="mt-3 flex flex-col gap-2">
                <Button type="button" className={primary} aria-label="Reconnect" data-testid="audio-reconnect"
                  onClick={() => (mode === "mic" && permission !== "granted" ? joinAudio("mic") : join === 0 ? joinAudio(mode ?? "listen") : setAttempt((value) => value + 1))}>
                  <RotateCcw aria-hidden="true" />Reconnect
                </Button>
              </div>
            </div>
          )}

          {connected && <>
            <p className="px-2 pt-2 text-xs text-muted-foreground">
              {speaking ? "Your microphone is on. The class can hear you." : mode === "listen" ? "You are listening. Tap the microphone to speak." : "Your microphone is off."}
              {" "}{roomCount === 1 ? "Only you are here." : `${roomCount} in the audio.`}
            </p>
            {(message || quality === "constrained") && (
              <p className="px-2 pt-2 text-xs leading-relaxed text-amber-300">{message || "Quality is reduced on a weak connection."}</p>
            )}
            {permission === "blocked" && (
              <ol className="mx-2 mt-2 list-decimal space-y-1 rounded-md bg-muted/50 p-2 pl-6 text-xs text-muted-foreground">
                {helpSteps.map((step) => <li key={step}>{step}</li>)}
              </ol>
            )}
            <div className="flex flex-col gap-0.5 py-1">
              {playbackBlocked && <Button type="button" variant="ghost" className={`${actionClass} text-amber-300`} aria-label="Enable sound" title="Enable sound" onClick={() => {
                void connection.current?.enableSound().then(() => setPlaybackBlocked(false)).catch(() => setPlaybackBlocked(true));
              }}><Volume2 aria-hidden="true" />Tap to turn on sound</Button>}
              {microphoneAvailable && <Button type="button" variant="ghost" className={actionClass}
                aria-label={speaking ? "Mute microphone" : teacher ? "Start speaking" : "Speak"}
                title={speaking ? "Mute microphone" : teacher ? "Start speaking" : "Speak"}
                onClick={() => toggleMicrophone()}>
                {speaking ? <MicOff aria-hidden="true" /> : <Radio aria-hidden="true" />}
                {speaking ? "Mute microphone" : teacher ? "Start speaking" : "Ask to speak"}
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
              <div className="my-1 border-t border-border" />
              <Button type="button" variant="ghost" className={`${actionClass} text-rose-300`} aria-label="Leave audio" title="Leave audio" data-testid="audio-leave"
                onClick={leaveAudio}><LogOut aria-hidden="true" />Leave audio</Button>
            </div>
          </>}
        </PopoverContent>
      </Popover>
      {connected && (
        <span className={`mr-1 flex size-6 items-center justify-center ${speaking ? "text-sidebar-primary" : "text-emerald-400"}`}
          role="img" aria-label={speaking ? "Connected, microphone active" : "Connected, microphone muted"}
          title={speaking ? "Connected, microphone active" : "Connected, microphone muted"}>
          <AudioLines aria-hidden="true" className="size-4" />
        </span>
      )}
    </aside>
  );
}
