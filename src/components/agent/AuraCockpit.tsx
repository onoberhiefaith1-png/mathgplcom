// Phase 3 — the AURA cockpit: a docked conversation panel that lives beside the
// platform on every page, so the teacher can talk on one side while the work
// happens on the other.

import { useCallback, useEffect, useRef, useState } from "react";
import { Ear, EarOff, Mic, MicOff, Square, Volume2, VolumeX, Trash2, X } from "lucide-react";

import auraMark from "@/assets/aura-mark.png";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AURA_MAX_WIDTH,
  AURA_MIN_WIDTH,
  useAura,
} from "@/lib/agent/AuraProvider";

import { AuraStepCard } from "./AuraStepCard";
import { useDictation } from "./useDictation";

const SUGGESTIONS = [
  "What should I prepare for my next class?",
  "Write a lesson note on solving quadratic equations by factoring.",
  "Create a class called Grade 9 Algebra and give me the join code.",
];

export default function AuraCockpit() {
  const {
    open,
    setOpen,
    width,
    setWidth,
    messages,
    status,
    speakReplies,
    setSpeakReplies,
    send,
    clear,
  } = useAura();

  const [draft, setDraft] = useState("");
  const dictation = useDictation((text) => setDraft((previous) => (previous ? `${previous} ${text}` : text)));
  const busy = status === "submitted";
  const dragging = useRef(false);

  const submit = useCallback(
    (message: PromptInputMessage) => {
      const text = (message.text || draft).trim();
      if (!text || busy) return;
      send(text, { spoken: dictation.listening });
      setDraft("");
      dictation.stop();
    },
    [busy, dictation, draft, send],
  );

  // Dragging the edge resizes the cockpit, exactly like a split workspace.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const move = (event: PointerEvent) => {
      if (!dragging.current) return;
      setWidth(window.innerWidth - event.clientX);
    };
    const up = () => {
      dragging.current = false;
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [setWidth]);

  // The page beside the cockpit gives up exactly the space the panel uses.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.style.setProperty("--aura-width", open ? `${width}px` : "0px");
    return () => {
      root.style.removeProperty("--aura-width");
    };
  }, [open, width]);

  if (!open) return null;

  return (
    <aside
      aria-label="Aura teaching assistant"
      className={cn(
        "fixed inset-y-0 right-0 z-[70] flex flex-col border-l border-border bg-background shadow-2xl",
        "w-full sm:w-[var(--aura-panel-width)]",
      )}
      style={{ ["--aura-panel-width" as string]: `${width}px` }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the assistant panel"
        aria-valuenow={width}
        aria-valuemin={AURA_MIN_WIDTH}
        aria-valuemax={AURA_MAX_WIDTH}
        tabIndex={0}
        onPointerDown={() => {
          dragging.current = true;
          document.body.style.userSelect = "none";
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") setWidth(width + 24);
          if (event.key === "ArrowRight") setWidth(width - 24);
        }}
        className="absolute inset-y-0 -left-1 hidden w-2 cursor-col-resize sm:block hover:bg-primary/20"
      />

      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <img src={auraMark} alt="" width={28} height={28} className="size-7 rounded-full" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">Aura</p>
          <p className="truncate text-xs text-muted-foreground">Your teaching assistant</p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={speakReplies ? "Turn off spoken replies" : "Turn on spoken replies"}
          onClick={() => setSpeakReplies(!speakReplies)}
        >
          {speakReplies ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Start a new conversation" onClick={clear}>
          <Trash2 className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Close the assistant" onClick={() => setOpen(false)}>
          <X className="size-4" />
        </Button>
      </header>

      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-4 p-3">
          {messages.length === 0 && !busy ? (
            <ConversationEmptyState
              icon={<img src={auraMark} alt="" width={48} height={48} className="size-12 rounded-full" />}
              title="Aura is ready"
              description="Tell her what you want taught, and she will set it up for you."
            >
              <div className="mt-3 flex flex-col gap-2">
                {SUGGESTIONS.map((text) => (
                  <Button
                    key={text}
                    variant="outline"
                    size="sm"
                    className="h-auto whitespace-normal py-2 text-left text-xs"
                    onClick={() => send(text)}
                  >
                    {text}
                  </Button>
                ))}
              </div>
            </ConversationEmptyState>
          ) : null}

          {messages.map((message) => (
            <Message key={message.id} from={message.role}>
              <MessageContent>
                <MessageResponse>{message.content}</MessageResponse>
                {message.steps && message.steps.length > 0 ? (
                  <div className="mt-1 flex flex-col gap-1.5">
                    {message.steps.map((step, index) => (
                      <AuraStepCard key={`${message.id}-${index}`} step={step} />
                    ))}
                  </div>
                ) : null}
              </MessageContent>
            </Message>
          ))}

          {busy ? (
            <Message from="assistant">
              <MessageContent>
                <Shimmer>Working on it…</Shimmer>
              </MessageContent>
            </Message>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border p-3">
        <PromptInput onSubmit={submit}>
          <PromptInputTextarea
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value)}
            placeholder={dictation.listening ? "Listening…" : "Ask Aura to set something up…"}
          />
          <PromptInputFooter>
            <PromptInputTools>
              {dictation.supported ? (
                <Button
                  type="button"
                  variant={dictation.listening ? "default" : "ghost"}
                  size="icon-sm"
                  aria-label={dictation.listening ? "Stop dictating" : "Dictate a message"}
                  onClick={dictation.toggle}
                >
                  {dictation.listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                </Button>
              ) : null}
            </PromptInputTools>
            <PromptInputSubmit
              status={busy ? "submitted" : undefined}
              disabled={busy || draft.trim().length === 0}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </aside>
  );
}
