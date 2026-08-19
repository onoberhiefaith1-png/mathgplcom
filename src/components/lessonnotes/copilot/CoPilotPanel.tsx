// MathGPL Copilot — the docked conversation.
//
// The procedure is fixed: greeting → lesson structure (with number controls)
// → additional information → analysis → narrated build → supervision.
// Every step runs through the editor bridge, which wraps the note's existing
// functions; the Copilot itself never writes the mathematics.

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, Send, Sparkles, X, Check, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import AutoTextarea from "@/components/lessonnotes/AutoTextarea";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { useCoPilotConversation } from "@/lib/lessonnotes/copilot/conversation";
import { isDestructive, type CoPilotBridge, type CoPilotMessage } from "@/lib/lessonnotes/copilot/actions";
import StructureCard from "./StructureCard";
import MaterialIntake from "./MaterialIntake";
import BuildProgress from "./BuildProgress";

interface Props {
  bridgeRef: React.MutableRefObject<CoPilotBridge | null>;
  onClose: () => void;
}


const StepRow = ({ label, state, detail }: { label: string; state: string; detail?: string }) => (
  <li className="flex items-start gap-2 text-[11px]">
    {state === "done" ? <Check className="h-3 w-3 mt-0.5 text-emerald-400" />
      : state === "running" ? <Loader2 className="h-3 w-3 mt-0.5 animate-spin text-amber-300" />
      : state === "failed" ? <X className="h-3 w-3 mt-0.5 text-red-400" />
      : <CircleDot className="h-3 w-3 mt-0.5 text-foreground/25" />}
    <span className={state === "pending" ? "text-foreground/40" : "text-foreground/80"}>
      {label}{detail ? ` — ${detail}` : ""}
    </span>
  </li>
);

function MessageBubble({
  m, onApprove, onReject,
}: { m: CoPilotMessage; onApprove: () => void; onReject: () => void }) {
  const teacher = m.role === "teacher";
  return (
    <div className={teacher ? "flex justify-end" : "flex justify-start"}>
      <div
        className={[
          "max-w-[92%] rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap",
          teacher ? "bg-amber-400/90 text-amber-950" : "bg-foreground/[0.07] text-foreground/90",
        ].join(" ")}
      >
        {m.text}

        {m.proposal && (
          <div className="mt-2.5 rounded-xl border border-foreground/15 bg-background/40 p-2.5 space-y-2">
            {m.proposal.preserves.length > 0 && (
              <div>
                <p className="text-[9px] uppercase tracking-[0.28em] text-foreground/40">Preserved</p>
                <ul className="mt-1 space-y-0.5">
                  {m.proposal.preserves.map((p, i) => (
                    <li key={i} className="text-[11px] text-foreground/65">• {p}</li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <p className="text-[9px] uppercase tracking-[0.28em] text-foreground/40">
                {m.run ? "Progress" : "Plan"}
              </p>
              <ul className="mt-1 space-y-1">
                {(m.run ?? m.proposal.steps.map((s) => ({ label: s, state: "pending" as const })))
                  .map((s: any, i: number) => (
                    <StepRow key={i} label={s.label} state={s.state} detail={s.detail} />
                  ))}
              </ul>
            </div>
            {m.proposal.actions.some(isDestructive) && !m.settled && (
              <p className="text-[10px] text-amber-300/90">
                This replaces existing content in the lesson note.
              </p>
            )}
            {!m.settled && (
              <div className="flex gap-2 pt-0.5">
                <Button size="sm" className="h-7 text-[11px] bg-amber-400 text-amber-950 hover:bg-amber-300" onClick={onApprove}>
                  Approve
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-[11px] text-foreground/60" onClick={onReject}>
                  Reject
                </Button>
              </div>
            )}
            {m.settled === "rejected" && (
              <p className="text-[10px] text-foreground/40">Rejected — nothing changed.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function CoPilotPanel({ bridgeRef, onClose }: Props) {
  const {
    mode, setMode, messages, busy, send, approve, reject,
    stage, counts, setCounts, confirmStructure,
    provideMaterial, skipMaterial, queue, resumeBuild,
  } = useCoPilotConversation(bridgeRef);
  const [text, setText] = useState("");
  const voice = useVoiceInput(setText as any);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy, stage, queue]);


  const submit = () => {
    const value = text.trim();
    if (!value) return;
    setText("");
    voice.reset();
    void send(value);
  };

  return (
    <aside
      className="h-full flex flex-col border-l border-foreground/10"
      style={{ background: "rgba(17,15,36,0.92)" }}
      aria-label="MyGPL Co-Pilot"
    >
      <header className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-b border-foreground/10">
        <Sparkles className="h-3.5 w-3.5 text-amber-300" />
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium text-foreground/90">MathGPL Copilot</p>
          <p className="text-[9.5px] text-foreground/40 truncate">
            Structure → material → analysis → build
          </p>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-foreground/50" onClick={onClose} aria-label="Close Copilot">
          <X className="h-3.5 w-3.5" />
        </Button>
      </header>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2.5">
        {messages.map((m) => (
          <MessageBubble key={m.id} m={m} onApprove={() => approve(m)} onReject={() => reject(m)} />
        ))}

        {stage === "structure" && (
          <StructureCard counts={counts} onChange={setCounts} onConfirm={confirmStructure} disabled={busy} />
        )}

        {stage === "material" && (
          <MaterialIntake onSubmit={provideMaterial} onSkip={skipMaterial} disabled={busy} />
        )}

        {(stage === "building" || stage === "idle") && queue.length > 0 && (
          <BuildProgress
            queue={queue}
            onResume={resumeBuild}
            showResume={stage === "idle" && queue.some((q) => q.state !== "done")}
          />
        )}

        {busy && (
          <p className="text-[11px] text-foreground/45 inline-flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            {stage === "analysing" ? "Reading your material…" : stage === "building" ? "Building…" : "Thinking…"}
          </p>
        )}
      </div>


      <div className="shrink-0 border-t border-foreground/10 p-2.5 space-y-2">
        <div className="flex items-center gap-1 rounded-full border border-foreground/15 p-0.5 w-fit">
          {(["plan", "create"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={[
                "px-2.5 py-1 rounded-full text-[10px] uppercase tracking-[0.2em] transition-colors",
                mode === m ? "bg-amber-400 text-amber-950" : "text-foreground/50 hover:text-foreground/80",
              ].join(" ")}
            >
              {m}
            </button>
          ))}
          <span className="pl-2 pr-1 text-[9.5px] text-foreground/35">
            {mode === "plan" ? "analyse only" : "acts after confirmation"}
          </span>
        </div>

        <div className="flex items-end gap-1.5">
          <AutoTextarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
            minRows={2}
            maxRows={8}
            placeholder="Talk to the Co-Pilot…"
            className="flex-1 rounded-xl bg-foreground/[0.06] border border-foreground/15 px-2.5 py-2 text-[12.5px] text-foreground/90 placeholder:text-foreground/30 outline-none focus:border-amber-300/50"
          />
          <Button
            size="icon" variant="ghost"
            className={`h-8 w-8 ${voice.listening ? "text-red-400" : "text-foreground/50"}`}
            onClick={() => (voice.listening ? voice.stop() : voice.start())}
            aria-label={voice.listening ? "Stop recording" : "Record a voice note"}
          >
            {voice.transcribing ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : voice.listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          </Button>
          <Button
            size="icon"
            className="h-8 w-8 bg-amber-400 text-amber-950 hover:bg-amber-300"
            onClick={submit}
            disabled={busy || !text.trim()}
            aria-label="Send"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </aside>
  );
}

export default CoPilotPanel;
