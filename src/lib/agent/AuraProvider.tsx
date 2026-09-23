// Phase 3 — the cockpit's state: one continuous conversation with Aura that
// survives page changes, remembers itself between visits, and reports each
// platform action she takes while it happens.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import {
  speakWithBrowserVoice,
  stopBrowserVoice,
  streamSpeech,
} from "@/components/agent/streamSpeech";
import {
  hasBeenAsked,
  micStatusLabel,
  micStatusTone,
  readMicPermission,
  requestMicrophoneAccess,
  watchMicPermission,
  type MicPermission,
  type MicTone,
} from "@/components/agent/micPermission";

import { useListening, type ListeningEngine } from "@/components/agent/useListening";

import { agentChat, agentGreeting } from "./brain.functions";
import { studyStep } from "./study.functions";
import { answerQuestion, emptyLedger, type MissionLedger } from "./missionLedger";
import { CallMetrics, describeCallTiming } from "./callMetrics";
import { streamCallTurn } from "./callStream";
import { SpeechQueue, takeClauses } from "./speechQueue";
import { contextFromPath, mergeContext, readAuraScreenContext } from "./context";
import type { AgentStep } from "./brain.server";
import { publishTeaching } from "./teachingBus";
import {
  ceilingReached,
  countRequest,
  describeUsage,
  IDLE_PAUSE_MS,
  readUsage,
  type AuraUsage,
} from "./usageLimits";
import type { TeachingScript } from "./teachingScript";
import {
  VoiceSession,
  describeVoiceState,
  takeSentences,
  type VoiceState,
} from "./voiceSession";


export type AuraRole = "user" | "assistant";

export type AuraMessage = {
  id: string;
  role: AuraRole;
  content: string;
  steps?: AgentStep[];
  error?: boolean;
  /** Set when the teacher dictated the message instead of typing it. */
  spoken?: boolean;
};

export type AuraStatus = "idle" | "submitted" | "error";

/** A lesson Aura is performing right now: what she is saying and where she is. */
export type AuraTeaching = {
  title: string;
  index: number;
  total: number;
  say: string;
  line: number | null;
};

type AuraValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  width: number;
  setWidth: (width: number) => void;
  messages: AuraMessage[];
  status: AuraStatus;
  liveSteps: AgentStep[];
  speakReplies: boolean;
  setSpeakReplies: (on: boolean) => void;
  /** True while Aura's own voice is playing. */
  speaking: boolean;
  stopSpeaking: () => void;
  /** Listening for her name anywhere in the platform. */
  wakeEnabled: boolean;
  setWakeEnabled: (on: boolean) => void;
  /** Microphone permission, asked once per person and remembered. */
  micPermission: MicPermission;
  micRequesting: boolean;
  micPromptOpen: boolean;
  setMicPromptOpen: (open: boolean) => void;
  /** Plain words and a colour for the status light in her panel. */
  micStatus: string;
  micTone: MicTone;
  /** Shows the browser's own permission prompt; resolves with the answer. */
  requestMic: () => Promise<MicPermission>;

  /** The one shared microphone: wake word and recorder both use it. */
  listening: ListeningEngine;
  /** Turn the recorder on or off; while on, the wave moves with the voice. */
  toggleRecorder: () => void;
  /** The live voice conversation behind the blue button. */
  voice: {
    state: VoiceState;
    active: boolean;
    statusLabel: string;
    /** Open the session; asks for the microphone once if it has never been given. */
    start: () => void;
    /** Close it: microphone released, any speech stopped. */
    end: () => void;
    /** Measured delays for the last turn, for teachers checking the speed. */
    timing: string | null;
  };

  /** Today's allowance: plain words when it is running low, else null. */
  usageNote: string | null;
  /** The lesson she is teaching aloud right now, or null. */
  teaching: AuraTeaching | null;
  stopTeaching: () => void;
  /**
   * Autonomous System Exploration: she is given a mission and explores the
   * platform herself, keeping her own record and asking without waiting.
   */
  mission: {
    mission: string | null;
    active: boolean;
    paused: boolean;
    ledger: MissionLedger;
    start: (mission: string) => void;
    pause: () => void;
    resume: () => void;
    end: () => void;
    /** Answer one of her open questions; she folds it into her next stretch. */
    answer: (questionId: string, answer: string) => void;
  };
  send: (text: string, options?: { spoken?: boolean }) => void;
  clear: () => void;
};

const AuraContext = createContext<AuraValue | null>(null);

const THREAD_KEY = "mathgpl:aura:thread";
const OPEN_KEY = "mathgpl:aura:open";
const WIDTH_KEY = "mathgpl:aura:width";
const VOICE_KEY = "mathgpl:aura:voice";
const WAKE_KEY = "mathgpl:aura:wake";

export const AURA_MIN_WIDTH = 320;
export const AURA_MAX_WIDTH = 720;
const AURA_DEFAULT_WIDTH = 420;
const MAX_REMEMBERED = 40;
/** A call with nothing said for this long hangs up itself. */
const IDLE_CALL_MS = 75_000;
/** And no single call runs longer than this. */
const MAX_CALL_MS = 20 * 60_000;

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function readStored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* a full or blocked store must never break the conversation */
  }
}

export function AuraProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const chat = useServerFn(agentChat);
  const greet = useServerFn(agentGreeting);

  // Aura sees the page the teacher is on, and whatever that page reports about
  // itself, so "this class" and "this lesson" never need explaining.
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const [hydrated, setHydrated] = useState(false);
  const [open, setOpenState] = useState(false);
  const [width, setWidthState] = useState(AURA_DEFAULT_WIDTH);
  const [messages, setMessages] = useState<AuraMessage[]>([]);
  const [status, setStatus] = useState<AuraStatus>("idle");
  const [liveSteps, setLiveSteps] = useState<AgentStep[]>([]);
  const [speakReplies, setSpeakRepliesState] = useState(false);
  const [wakeEnabled, setWakeEnabledState] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [micPermission, setMicPermission] = useState<MicPermission>("unknown");
  const [micRequesting, setMicRequesting] = useState(false);
  const [micPromptOpen, setMicPromptOpen] = useState(false);
  const [usage, setUsage] = useState<AuraUsage>({ day: "", used: 0 });
  const lastActiveRef = useRef(Date.now());
  const greetedRef = useRef(false);
  const voice = useRef<AbortController | null>(null);
  /** Her voice during a call: clauses fetched ahead and played gaplessly. */
  const queue = useRef<SpeechQueue | null>(null);
  /** True while a call reply is still being written, so her voice can dry up
   *  between clauses without the turn being declared finished. */
  const callWriting = useRef(false);
  /** Set when the teacher talked over her: the rest of that reply is not spoken. */
  const callMuted = useRef(false);
  const callStream = useRef<AbortController | null>(null);
  const callStartedAt = useRef(0);
  const lastVoiceAt = useRef(0);
  /** Honest measurements of how long each spoken turn actually took. */
  const metrics = useRef(new CallMetrics());
  const [timing, setTiming] = useState<string | null>(null);

  const stopSpeaking = useCallback(() => {
    voice.current?.abort();
    voice.current = null;
    stopBrowserVoice();
    setSpeaking(false);
  }, []);

  // ── THE LIVE CONVERSATION ────────────────────────────────────────────────
  // One open session: she hears every word, works out when a sentence has ended,
  // answers out loud, and stops mid-word the moment someone speaks over her.
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  /** Set once endVoice exists, so a turn can hang up before it is defined. */
  const endVoiceRef = useRef<(() => void) | null>(null);
  const session = useRef<VoiceSession | null>(null);
  const levelRef = useRef(0);
  const heardRef = useRef("");
  const voiceLive = useRef(false);

  // Aura's own voice: streamed natural speech, one sentence at a time so she
  // starts talking sooner and can be cut off cleanly. The browser voice is a
  // last resort so a reply is never silent.
  const speak = useCallback(
    async (text: string) => {
      const said = text.trim();
      if (!said) return;
      const { sentences, rest } = takeSentences(said);
      const parts = [...sentences, rest.trim()].filter(Boolean);
      if (parts.length === 0) return;

      voice.current?.abort();
      const controller = new AbortController();
      voice.current = controller;
      setSpeaking(true);
      session.current?.replyStarted();
      setVoiceState(session.current?.state ?? "idle");
      try {
        for (const part of parts) {
          if (controller.signal.aborted) break;
          try {
            await streamSpeech(part, controller.signal);
          } catch {
            if (!controller.signal.aborted) speakWithBrowserVoice(part);
          }
        }
      } finally {
        if (voice.current === controller) voice.current = null;
        setSpeaking(false);
        // A cut has already moved her on; only a finished reply leads to waiting.
        if (session.current?.state === "speaking") {
          session.current.replyEnded();
          setVoiceState(session.current.state);
        }
      }
    },
    [],
  );


  // ── TEACHING OUT LOUD ────────────────────────────────────────────────────
  // She says one micro-step, the board moves to that line, then the next. Any
  // new lesson (or Stop) cancels the one running: only one voice teaches.
  const [teaching, setTeaching] = useState<AuraTeaching | null>(null);
  const teachRun = useRef(0);

  const stopTeaching = useCallback(() => {
    teachRun.current += 1;
    setTeaching(null);
    publishTeaching({ kind: "end" });
    stopSpeaking();
  }, [stopSpeaking]);

  const teach = useCallback(
    async (script: TeachingScript) => {
      teachRun.current += 1;
      const run = teachRun.current;
      const total = script.steps.length;
      for (let index = 0; index < total; index += 1) {
        if (teachRun.current !== run) return;
        const step = script.steps[index]!;
        setTeaching({ title: script.title, index, total, say: step.say, line: step.line });
        if (step.line) publishTeaching({ kind: "focus", line: step.line });
        await speak(step.say);
        if (teachRun.current !== run) return;
        // A breath between steps, the way a teacher pauses at the board.
        await new Promise((resolve) => window.setTimeout(resolve, 260));
      }
      if (teachRun.current !== run) return;
      setTeaching(null);
      publishTeaching({ kind: "end" });
    },
    [speak],
  );

  const teachRef = useRef(teach);
  useEffect(() => {
    teachRef.current = teach;
  }, [teach]);

  // Browser storage is read after hydration so the server and the first client
  // render agree on an empty, closed cockpit.
  useEffect(() => {
    setMessages(readStored<AuraMessage[]>(THREAD_KEY, []));
    setOpenState(readStored<boolean>(OPEN_KEY, false));
    setWidthState(readStored<number>(WIDTH_KEY, AURA_DEFAULT_WIDTH));
    setSpeakRepliesState(readStored<boolean>(VOICE_KEY, false));
    setUsage(readUsage());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) writeStored(THREAD_KEY, messages.slice(-MAX_REMEMBERED));
  }, [hydrated, messages]);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    writeStored(OPEN_KEY, next);
  }, []);

  const toggle = useCallback(() => {
    setOpenState((previous) => {
      writeStored(OPEN_KEY, !previous);
      return !previous;
    });
  }, []);

  const setWidth = useCallback((next: number) => {
    const clamped = Math.min(AURA_MAX_WIDTH, Math.max(AURA_MIN_WIDTH, Math.round(next)));
    setWidthState(clamped);
    writeStored(WIDTH_KEY, clamped);
  }, []);

  const setSpeakReplies = useCallback(
    (on: boolean) => {
      setSpeakRepliesState(on);
      writeStored(VOICE_KEY, on);
      if (!on) stopSpeaking();
    },
    [stopSpeaking],
  );

  const setWakeEnabled = useCallback((on: boolean) => {
    setWakeEnabledState(on);
    writeStored(WAKE_KEY, on);
  }, []);

  const send = useCallback(
    (text: string, options?: { spoken?: boolean }) => {
      const content = text.trim();
      if (!content || status === "submitted") return;

      // Today's ceiling: she says so plainly instead of working on quietly.
      const counted = countRequest();
      setUsage(counted);
      lastActiveRef.current = Date.now();
      if (ceilingReached(counted)) {
        setMessages((previous) => [
          ...previous,
          { id: newId(), role: "user", content, spoken: options?.spoken },
          {
            id: newId(),
            role: "assistant",
            content:
              "That's today's limit for me on this device — I'll be ready again tomorrow.",
            error: true,
          },
        ]);
        setStatus("idle");
        return;
      }

      // A word from the administrator during a study run is folded into it, so
      // the correction travels with her next stretch of work.
      if (studyActive.current) studyNotes.current.push({ role: "user", content });

      const history = [...messages, { id: newId(), role: "user" as const, content, spoken: options?.spoken }];
      setMessages(history);
      setStatus("submitted");
      setLiveSteps([]);

      void chat({
        data: {
          messages: history
            .filter((m) => !m.error)
            .map((m) => ({ role: m.role, content: m.content })),
          context: mergeContext(
            contextFromPath(pathnameRef.current),
            readAuraScreenContext(),
          ),
        },
      })
        .then((turn) => {
          setMessages((previous) => [
            ...previous,
            { id: newId(), role: "assistant", content: turn.reply, steps: turn.steps },
          ]);
          setLiveSteps([]);
          setStatus("idle");
          const lesson = turn.steps?.find((step) => step.teach)?.teach;
          // In a live conversation she always answers out loud.
          if (lesson) void teachRef.current(lesson);
          else if (speakReplies || voiceLive.current) void speak(turn.reply);
          else if (session.current?.state === "thinking") {
            session.current.replyEnded();
            setVoiceState(session.current.state);
          }
          if (turn.navigateTo) {
            void navigate({ to: turn.navigateTo as never }).catch(() => {
              /* a page that refuses to open is reported by the agent itself */
            });
          }
        })
        .catch((error: unknown) => {
          setMessages((previous) => [
            ...previous,
            {
              id: newId(),
              role: "assistant",
              content:
                (error as Error)?.message?.trim() ||
                "I couldn't finish that just now. Try me again in a moment.",
              error: true,
            },
          ]);
          setLiveSteps([]);
          setStatus("error");
          // A failed turn must never leave the session stuck thinking.
          if (session.current?.state === "thinking") {
            session.current.replyEnded();
            setVoiceState(session.current.state);
          }
        });

    },
    [chat, messages, navigate, speak, speakReplies, status],
  );


  // ── A CALL TURN ──────────────────────────────────────────────────────────
  // Her answer is spoken as it is written: the first clause goes to her voice
  // while the rest is still arriving, which is what makes this feel like a call.
  const sendCall = useCallback(
    (text: string) => {
      const content = text.trim();
      if (!content) return;

      const counted = countRequest();
      setUsage(counted);
      lastActiveRef.current = Date.now();
      if (ceilingReached(counted)) {
        setMessages((previous) => [
          ...previous,
          { id: newId(), role: "user", content, spoken: true },
          {
            id: newId(),
            role: "assistant",
            content: "That's today's limit for me on this device — I'll be ready again tomorrow.",
            error: true,
          },
        ]);
        setStatus("idle");
        endVoiceRef.current?.();
        return;
      }

      const history = [...messages, { id: newId(), role: "user" as const, content, spoken: true }];
      setMessages(history);
      setStatus("submitted");
      setLiveSteps([]);

      const speech = queue.current;
      const controller = new AbortController();
      callStream.current?.abort();
      callStream.current = controller;
      callWriting.current = true;
      callMuted.current = false;
      let buffer = "";
      /** True until her first clause has gone to her voice in this reply. */
      let opening = true;
      speech?.beginReply();

      const say = (clause: string) => {
        if (callMuted.current || !speech) return;
        speech.say(clause);
      };

      void streamCallTurn({
        messages: history
          .filter((m) => !m.error)
          .map((m) => ({ role: m.role, content: m.content })),
        context: mergeContext(contextFromPath(pathnameRef.current), readAuraScreenContext()),
        signal: controller.signal,
        onDelta: (delta) => {
          metrics.current.mark("firstToken", performance.now());
          setTiming(describeCallTiming(metrics.current.summary()));
          buffer += delta;
          // Her first clause is cut short so her voice starts almost at once;
          // everything after it is cut at ordinary speaking lengths.
          const { clauses, rest } = takeClauses(buffer, { first: opening });
          buffer = rest;
          if (clauses.length) opening = false;
          for (const clause of clauses) say(clause);
        },
      })
        .then((turn) => {
          const { clauses } = takeClauses(buffer, true);
          buffer = "";
          for (const clause of clauses) say(clause);
          callWriting.current = false;
          setMessages((previous) => [
            ...previous,
            { id: newId(), role: "assistant", content: turn.reply, steps: turn.steps },
          ]);
          setLiveSteps([]);
          setStatus("idle");
          const lesson = turn.steps?.find((step) => step.teach)?.teach;
          if (lesson) void teachRef.current(lesson);
          // Nothing to say out loud: go straight back to listening.
          if (!speech?.active && session.current?.state !== "listening") {
            session.current?.replyEnded();
            setVoiceState(session.current?.state ?? "idle");
          }
          if (turn.navigateTo) {
            void navigate({ to: turn.navigateTo as never }).catch(() => {
              /* a page that refuses to open is reported by the agent itself */
            });
          }
        })
        .catch((error: unknown) => {
          callWriting.current = false;
          if (controller.signal.aborted) return;
          setMessages((previous) => [
            ...previous,
            {
              id: newId(),
              role: "assistant",
              content:
                (error as Error)?.message?.trim() ||
                "I couldn't finish that just now. Try me again in a moment.",
              error: true,
            },
          ]);
          setLiveSteps([]);
          setStatus("error");
          session.current?.replyEnded();
          setVoiceState(session.current?.state ?? "idle");
        });
    },
    [messages, navigate],
  );

  const sendCallRef = useRef(sendCall);
  useEffect(() => {
    sendCallRef.current = sendCall;
  }, [sendCall]);

  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  const onWake = useCallback(
    (command: string) => {
      setOpen(true);
      if (command) sendRef.current(command, { spoken: true });
    },
    [setOpen],
  );

  // One microphone for everything: her name and the recorder share it, so they
  // can never cancel each other out.
  const listening = useListening({
    onWake,
    paused: speaking || status === "submitted",
  });

  /** The microphone she was granted, kept rather than asked for twice. */
  const granted = useRef<MediaStream | null>(null);
  const wakeEnabledRef = useRef(wakeEnabled);
  useEffect(() => {
    wakeEnabledRef.current = wakeEnabled;
  }, [wakeEnabled]);

  // Whether this person has allowed the microphone yet. Read from the browser,
  // and kept in step if they change it in their browser settings later.
  useEffect(() => {
    void readMicPermission().then(setMicPermission);
    return watchMicPermission((state) => {
      setMicPermission(state);
      if (state === "granted") setMicPromptOpen(false);
    });
  }, []);

  // Release the microphone when she is no longer on screen.
  useEffect(
    () => () => {
      granted.current?.getTracks().forEach((track) => track.stop());
      granted.current = null;
    },
    [],
  );


  // Everyone who arrives is asked once, so Aura is ready to listen from the
  // start. Never asked again on this device once they have answered.
  useEffect(() => {
    if (!hydrated || hasBeenAsked()) return;
    if (micPermission !== "prompt" && micPermission !== "unknown") return;
    const timer = window.setTimeout(() => setMicPromptOpen(true), 1200);
    return () => window.clearTimeout(timer);
  }, [hydrated, micPermission]);

  // The one request for the microphone. The stream it returns is kept and handed
  // straight to the listening engine, so allowing is the last thing she needs.
  const requestMic = useCallback(async () => {
    setMicRequesting(true);
    const { state, stream } = await requestMicrophoneAccess();
    setMicRequesting(false);
    setMicPermission(state);
    if (state === "granted") {
      setMicPromptOpen(false);
      granted.current = stream ?? null;
      listening.clearError();
      listening.start(wakeEnabledRef.current ? "wake" : "capture", stream ?? null);
    } else {
      setMicPromptOpen(true);
    }
    return state;
  }, [listening]);

  /** Nothing listens until permission is settled; otherwise we ask for it. */
  const ensureMic = useCallback(async () => {
    if (micPermission === "granted") return true;
    if (micPermission === "prompt" || micPermission === "unknown") {
      if (!hasBeenAsked()) {
        // First time on this device: explain before the browser prompt appears.
        setMicPromptOpen(true);
        return false;
      }
      return (await requestMic()) === "granted";
    }
    setMicPromptOpen(true);
    return false;
  }, [micPermission, requestMic]);


  // Keep the background ear running whenever the teacher has it switched on.
  useEffect(() => {
    if (!wakeEnabled) {
      if (listening.mode === "wake") listening.stop();
      return;
    }
    if (!listening.supported) {
      setWakeEnabledState(false);
      return;
    }
    if (micPermission !== "granted") return;
    if (listening.mode === "off" && !listening.error) listening.start("wake");
  }, [listening, micPermission, wakeEnabled]);

  // Nobody leaves her listening all day by accident: after a long silence the
  // ear switches itself off, and the teacher can switch it straight back on.
  useEffect(() => {
    if (!wakeEnabled) return;
    const timer = window.setInterval(() => {
      if (Date.now() - lastActiveRef.current < IDLE_PAUSE_MS) return;
      setWakeEnabled(false);
      if (listening.mode === "wake") listening.stop();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [listening, setWakeEnabled, wakeEnabled]);

  const setWakeEnabledGated = useCallback(
    (on: boolean) => {
      if (!on) {
        setWakeEnabled(false);
        return;
      }
      if (micPermission !== "granted") {
        void ensureMic().then((allowed) => {
          if (allowed) setWakeEnabled(true);
        });
        return;
      }
      setWakeEnabled(true);
    },
    [ensureMic, micPermission, setWakeEnabled],
  );

  const toggleRecorder = useCallback(() => {
    if (listening.mode === "capture") {
      // Hand the microphone back to her name if the ear is on.
      if (wakeEnabled) listening.start("wake");
      else listening.stop();
      return;
    }
    if (micPermission !== "granted") {
      void ensureMic().then((allowed) => {
        if (allowed) listening.start("capture");
      });
      return;
    }
    listening.start("capture");
  }, [ensureMic, listening, micPermission, wakeEnabled]);

  // ── THE OPEN SESSION ─────────────────────────────────────────────────────
  // The blue button opens this and nothing closes it but the teacher. A reading
  // of the microphone every 60ms is all the state machine needs.
  useEffect(() => {
    levelRef.current = listening.level;
    heardRef.current = listening.transcript;
  }, [listening.level, listening.transcript]);

  const endVoice = useCallback(() => {
    voiceLive.current = false;
    callStream.current?.abort();
    callStream.current = null;
    callWriting.current = false;
    queue.current?.close();
    queue.current = null;
    session.current?.end();
    session.current = null;
    setVoiceState("idle");
    voice.current?.abort();
    voice.current = null;
    stopBrowserVoice();
    setSpeaking(false);
    if (wakeEnabledRef.current) listening.start("wake");
    else listening.stop();
  }, [listening]);

  useEffect(() => {
    endVoiceRef.current = endVoice;
  }, [endVoice]);

  const startVoice = useCallback(() => {
    const open = () => {
      setOpen(true);
      listening.clearError();
      listening.start("capture", granted.current);
      // The device is opened on this very tap, which is what phones require, and
      // then kept for the whole call so no sentence is ever clipped.
      const speech = new SpeechQueue({
        onSpeaking: (on) => {
          if (on) {
            setSpeaking(true);
            session.current?.replyStarted();
            setVoiceState(session.current?.state ?? "idle");
            return;
          }
          // Between clauses of a reply still being written she is not finished.
          if (callWriting.current) return;
          setSpeaking(false);
          metrics.current.mark("speechEnd", performance.now());
          setTiming(describeCallTiming(metrics.current.summary()));
          if (session.current?.state === "speaking") {
            session.current.replyEnded();
            setVoiceState(session.current.state);
          }
        },
        onFailed: (said) => {
          if (!callMuted.current) speakWithBrowserVoice(said);
        },
        onFirstAudio: () => {
          metrics.current.mark("firstAudio", performance.now());
          setTiming(describeCallTiming(metrics.current.summary()));
        },
      });
      // The device and the speech connection are opened now, while the call is
      // starting, so her very first clause does not pay for either.
      void speech.warm();
      queue.current = speech;
      metrics.current.reset();
      setTiming(null);
      callStartedAt.current = performance.now();
      lastVoiceAt.current = performance.now();
      const machine = new VoiceSession();
      machine.begin(performance.now());
      session.current = machine;
      voiceLive.current = true;
      setVoiceState(machine.state);
    };
    if (micPermission !== "granted") {
      void ensureMic().then((allowed) => {
        if (allowed) open();
      });
      return;
    }
    open();
  }, [ensureMic, listening, micPermission, setOpen]);

  useEffect(() => {
    if (voiceState === "idle") return;
    const timer = window.setInterval(() => {
      const machine = session.current;
      if (!machine) return;
      const now = performance.now();
      const effects = machine.feed({
        now,
        level: levelRef.current,
        transcript: heardRef.current,
        // Her own voice comes back through the loudspeaker; only speech above it
        // counts as talking over her.
        selfLevel: queue.current?.outputLevel() ?? 0,
        finalPending: listening.finalPending(),
      });
      if (machine.state === "listening") lastVoiceAt.current = now;
      for (const effect of effects) {
        if (effect.kind === "cut") {
          callMuted.current = true;
          queue.current?.flush();
          voice.current?.abort();
          voice.current = null;
          stopBrowserVoice();
          setSpeaking(false);
          listening.clearTranscript();
          heardRef.current = "";
        }
        if (effect.kind === "turn") {
          // The clock for this turn starts the moment their words were closed off.
          metrics.current.mark("turnClosed", now);
          listening.clearTranscript();
          heardRef.current = "";
          if (voiceLive.current) sendCallRef.current(effect.text);
          else sendRef.current(effect.text, { spoken: true });
        }
      }
      // A call left open by accident hangs up itself, and no call runs forever.
      if (voiceLive.current && machine.state !== "thinking" && machine.state !== "speaking") {
        const silent = now - lastVoiceAt.current;
        const total = now - callStartedAt.current;
        if (silent > IDLE_CALL_MS || total > MAX_CALL_MS) {
          setMessages((previous) => [
            ...previous,
            {
              id: newId(),
              role: "assistant",
              content:
                silent > IDLE_CALL_MS
                  ? "I've ended the call for now — tap the call button whenever you want me back."
                  : "We've been on for a while, so I've ended the call. Tap it again to carry on.",
            },
          ]);
          endVoiceRef.current?.();
          return;
        }
      }
      setVoiceState(machine.state);
    }, 60);
    return () => window.clearInterval(timer);
  }, [listening, voiceState]);

  // Leaving the page must never leave the microphone open.
  useEffect(() => () => {
    session.current?.end();
    session.current = null;
    voiceLive.current = false;
  }, []);


  const clear = useCallback(() => {
    setMessages([]);
    setLiveSteps([]);
    setStatus("idle");
    greetedRef.current = false;
    writeStored(THREAD_KEY, []);
  }, []);

  // The first time the cockpit is opened on an empty conversation, Aura speaks
  // first — from a real workspace snapshot, never a generic hello.
  useEffect(() => {
    if (!hydrated || !open || greetedRef.current || messages.length > 0) return;
    greetedRef.current = true;
    setStatus("submitted");
    void greet({})
      .then(({ greeting }) => {
        setMessages([{ id: newId(), role: "assistant", content: greeting }]);
        setStatus("idle");
        if (speakReplies) void speak(greeting);
      })
      .catch(() => {
        setMessages([
          {
            id: newId(),
            role: "assistant",
            content: "Tell me what you'd like to set up and I'll take it from there.",
          },
        ]);
        setStatus("idle");
      });
  }, [greet, hydrated, messages.length, open, speak, speakReplies]);

  // Hydrate the wake-word preference alongside the others.
  useEffect(() => {
    setWakeEnabledState(readStored<boolean>(WAKE_KEY, false));
  }, []);

  // ── AUTONOMOUS SYSTEM EXPLORATION ────────────────────────────────────────
  // The administrator names a mission; she explores the platform herself, one
  // stretch at a time, keeping her own record of what she knows and does not
  // know and reporting in this panel as she goes. Nothing reaches a student.
  const runStudy = useServerFn(studyStep);
  const [missionText, setMissionText] = useState<string | null>(null);
  const [missionLedger, setMissionLedger] = useState<MissionLedger>(() => emptyLedger());
  const [missionPaused, setMissionPaused] = useState(false);
  const missionRun = useRef(0);
  const missionId = useRef<string | null>(null);
  const studyActive = useRef(false);
  const studyNotes = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const ledgerRef = useRef<MissionLedger>(emptyLedger());
  const pausedRef = useRef(false);

  const endStudy = useCallback(() => {
    missionRun.current += 1;
    studyActive.current = false;
    pausedRef.current = false;
    setMissionPaused(false);
    setMissionText(null);
    setStatus("idle");
  }, []);

  const pauseMission = useCallback(() => {
    pausedRef.current = true;
    setMissionPaused(true);
  }, []);

  const resumeMission = useCallback(() => {
    pausedRef.current = false;
    setMissionPaused(false);
  }, []);

  const answerMissionQuestion = useCallback((questionId: string, answer: string) => {
    const text = answer.trim();
    if (!text) return;
    const next = answerQuestion(ledgerRef.current, questionId, text);
    ledgerRef.current = next;
    setMissionLedger(next);
    if (studyActive.current) studyNotes.current.push({ role: "user", content: text });
  }, []);

  const startStudy = useCallback(
    (mission: string) => {
      const goal = mission.trim();
      if (!goal) return;
      missionRun.current += 1;
      const run = missionRun.current;
      studyActive.current = true;
      studyNotes.current = [];
      ledgerRef.current = emptyLedger();
      missionId.current = newId();
      pausedRef.current = false;
      setMissionPaused(false);
      setMissionLedger(ledgerRef.current);
      setMissionText(goal);
      setOpen(true);
      setMessages((previous) => [
        ...previous,
        { id: newId(), role: "user", content: `Mission: ${goal}` },
      ]);

      void (async () => {
        for (let round = 0; round < 24; round += 1) {
          if (missionRun.current !== run) return;
          // Paused: she holds still until the administrator lets her carry on.
          while (pausedRef.current && missionRun.current === run) {
            await new Promise((resolve) => setTimeout(resolve, 800));
          }
          if (missionRun.current !== run) return;
          setStatus("submitted");
          setLiveSteps([]);
          try {
            const turn = await runStudy({
              data: {
                subject: goal,
                transcript: studyNotes.current,
                ledger: ledgerRef.current,
                missionId: missionId.current,
              },
            });
            if (missionRun.current !== run) return;
            if (turn.ledger) {
              // Answers typed while she was working must survive her own record.
              const incoming = turn.ledger as MissionLedger;
              const mine = ledgerRef.current;
              const merged: MissionLedger = {
                ...incoming,
                questions: incoming.questions.map((q) => {
                  const answered = mine.questions.find((x) => x.id === q.id && x.status === "answered");
                  return answered ?? q;
                }),
                corrections: Array.from(new Set([...mine.corrections, ...incoming.corrections])),
              };
              ledgerRef.current = merged;
              setMissionLedger(merged);
            }
            studyNotes.current = [
              ...studyNotes.current,
              { role: "assistant" as const, content: turn.say },
            ].slice(-40);
            setMessages((previous) => [
              ...previous,
              { id: newId(), role: "assistant", content: turn.say, steps: turn.steps },
            ]);
            setStatus("idle");
            if (turn.done) break;
          } catch (error) {
            if (missionRun.current !== run) return;
            setMessages((previous) => [
              ...previous,
              {
                id: newId(),
                role: "assistant",
                content:
                  (error as Error)?.message?.trim() || "The exploration stopped before I could finish.",
                error: true,
              },
            ]);
            setStatus("error");
            break;
          }
        }
        if (missionRun.current === run) {
          studyActive.current = false;
          setMissionText(null);
        }
      })();
    },
    [runStudy, setOpen],
  );


  const value = useMemo<AuraValue>(
    () => ({
      open,
      setOpen,
      toggle,
      width,
      setWidth,
      messages,
      status,
      liveSteps,
      speakReplies,
      setSpeakReplies,
      speaking,
      stopSpeaking,
      wakeEnabled,
      setWakeEnabled: setWakeEnabledGated,
      micPermission,
      micRequesting,
      micPromptOpen,
      setMicPromptOpen,
      micStatus: listening.errorMessage
        ? listening.errorMessage
        : micStatusLabel(micPermission, micRequesting, listening.mode !== "off"),
      micTone: listening.error
        ? "error"
        : micStatusTone(micPermission, micRequesting, listening.mode !== "off"),

      requestMic,

      listening,
      toggleRecorder,
      voice: {
        state: voiceState,
        active: voiceState !== "idle",
        statusLabel: describeVoiceState(voiceState),
        start: startVoice,
        end: endVoice,
        timing,
      },
      teaching,
      stopTeaching,
      usageNote: describeUsage(usage),
      mission: {
        mission: missionText,
        active: missionText !== null,
        paused: missionPaused,
        ledger: missionLedger,
        start: startStudy,
        pause: pauseMission,
        resume: resumeMission,
        end: endStudy,
        answer: answerMissionQuestion,
      },
      send,
      clear,
    }),
    [
      clear,
      endVoice,
      startVoice,
      voiceState,
      listening,

      micPermission,
      micPromptOpen,
      micRequesting,
      requestMic,
      setWakeEnabledGated,
      toggleRecorder,
      liveSteps,
      messages,
      open,
      send,
      setOpen,
      setSpeakReplies,
      setWakeEnabled,
      setWidth,
      speakReplies,
      speaking,
      status,
      stopSpeaking,
      stopTeaching,
      teaching,
      startStudy,
      endStudy,
      missionText,
      missionLedger,
      missionPaused,
      pauseMission,
      resumeMission,
      answerMissionQuestion,
      toggle,
      usage,
      wakeEnabled,
      width,
    ],
  );

  return <AuraContext.Provider value={value}>{children}</AuraContext.Provider>;
}

export function useAura(): AuraValue {
  const value = useContext(AuraContext);
  if (!value) throw new Error("useAura must be used inside AuraProvider.");
  return value;
}
