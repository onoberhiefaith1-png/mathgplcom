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
import { useNavigate } from "@tanstack/react-router";
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
import type { AgentStep } from "./brain.server";

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
  const greetedRef = useRef(false);
  const voice = useRef<AbortController | null>(null);

  const stopSpeaking = useCallback(() => {
    voice.current?.abort();
    voice.current = null;
    stopBrowserVoice();
    setSpeaking(false);
  }, []);

  // Aura's own voice: streamed natural speech, with the browser voice as a
  // last resort so a reply is never silent.
  const speak = useCallback(
    (text: string) => {
      const said = text.trim();
      if (!said) return;
      voice.current?.abort();
      const controller = new AbortController();
      voice.current = controller;
      setSpeaking(true);
      void streamSpeech(said, controller.signal)
        .catch(() => {
          if (!controller.signal.aborted) speakWithBrowserVoice(said);
        })
        .finally(() => {
          if (voice.current === controller) voice.current = null;
          setSpeaking(false);
        });
    },
    [],
  );

  // Browser storage is read after hydration so the server and the first client
  // render agree on an empty, closed cockpit.
  useEffect(() => {
    setMessages(readStored<AuraMessage[]>(THREAD_KEY, []));
    setOpenState(readStored<boolean>(OPEN_KEY, false));
    setWidthState(readStored<number>(WIDTH_KEY, AURA_DEFAULT_WIDTH));
    setSpeakRepliesState(readStored<boolean>(VOICE_KEY, false));
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

      const history = [...messages, { id: newId(), role: "user" as const, content, spoken: options?.spoken }];
      setMessages(history);
      setStatus("submitted");
      setLiveSteps([]);

      void chat({
        data: {
          messages: history
            .filter((m) => !m.error)
            .map((m) => ({ role: m.role, content: m.content })),
        },
      })
        .then((turn) => {
          setMessages((previous) => [
            ...previous,
            { id: newId(), role: "assistant", content: turn.reply, steps: turn.steps },
          ]);
          setLiveSteps([]);
          setStatus("idle");
          if (speakReplies) speak(turn.reply);
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
        });
    },
    [chat, messages, navigate, speak, speakReplies, status],
  );

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
        if (speakReplies) speak(greeting);
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
      send,
      clear,
    }),
    [
      clear,
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
      toggle,
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
