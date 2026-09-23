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
  send: (text: string, options?: { spoken?: boolean }) => void;
  clear: () => void;
};

const AuraContext = createContext<AuraValue | null>(null);

const THREAD_KEY = "mathgpl:aura:thread";
const OPEN_KEY = "mathgpl:aura:open";
const WIDTH_KEY = "mathgpl:aura:width";
const VOICE_KEY = "mathgpl:aura:voice";

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

/** Speak a reply with the browser's own voice; Phase 4 replaces this with streamed speech. */
function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 900));
    utterance.rate = 1.02;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  } catch {
    /* speech is a courtesy, never a requirement */
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
  const greetedRef = useRef(false);

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

  const setSpeakReplies = useCallback((on: boolean) => {
    setSpeakRepliesState(on);
    writeStored(VOICE_KEY, on);
    if (!on && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
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
    [chat, messages, navigate, speakReplies, status],
  );

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
    void greet({ data: {} })
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
  }, [greet, hydrated, messages.length, open, speakReplies]);

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
      send,
      clear,
    }),
    [
      clear,
      liveSteps,
      messages,
      open,
      send,
      setOpen,
      setSpeakReplies,
      setWidth,
      speakReplies,
      status,
      toggle,
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
