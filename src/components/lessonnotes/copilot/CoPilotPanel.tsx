// MathGPL Co-Pilot — the docked conversation.
//
// The Co-Pilot understands the APPLICATION. Whenever a request needs
// mathematics it goes through the MathGPL Math Engine; the panel itself never
// writes mathematics. The procedure is fixed: greeting → lesson structure →
// additional information → analysis → narrated build → supervision.
//
// There is no PLAN / CREATE switch: the teacher just talks. Additive work
// happens; anything that replaces existing content asks first.

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, Send, Sparkles, X, Check, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import AutoTextarea from "@/components/lessonnotes/AutoTextarea";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { useCoPilotConversation } from "@/lib/lessonnotes/copilot/conversation";
import { isDestructive, type CoPilotBridge, type CoPilotMessage } from "@/lib/lessonnotes/copilot/actions";
import StructureCard from "./StructureCard";
import MaterialIntake from "./MaterialIntake";
import BlueprintCard from "./BlueprintCard";
import BuildProgress from "./BuildProgress";

interface Props {
  bridgeRef: React.MutableRefObject<CoPilotBridge | null>;
  onClose: () => void;
}

/** Real stages only — never developer phrasing. */
const STAGE_TEXT: Record<string, string> = {
  greeting: "Reading the lesson",
  structure: "Waiting on the structure",
  material: "Waiting on your material",
  analysing: "Analysing the topic",
  building: "Building the lesson",
  idle: "Thinking",
};

const StepRow = ({ label, state, detail }: { label: string; state: string; detail?: string }) => (
  <li className="flex items-start gap-2 text-[11.5px]">
    {state === "done" ? <Check className="h-3 w-3 mt-0.5 text-emerald-600" />
      : state === "running" ? <Loader2 className="h-3 w-3 mt-0.5 animate-spin text-amber-600" />
      : state === "failed" ? <X className="h-3 w-3 mt-0.5 text-red-600" />
      : <CircleDot className="h-3 w-3 mt-0.5 text-slate-300" />}
    <span className={state === "pending" ? "text-slate-400" : "text-slate-700"}>
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
          "max-w-[92%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap",
          teacher
            ? "bg-slate-900 text-white"
            : "bg-white text-slate-800 border border-slate-200",
        ].join(" ")}
      >
        {m.text}

        {m.proposal && (
          <div className="mt-2.5 rounded-xl border border-slate-200 bg-slate-50 p-2.5 space-y-2">
            {m.proposal.preserves.length > 0 && (
              <div>
                <p className="text-[9px] uppercase tracking-[0.28em] text-slate-400">Preserved</p>
                <ul className="mt-1 space-y-0.5">
                  {m.proposal.preserves.map((p, i) => (
                    <li key={i} className="text-[11.5px] text-slate-600">• {p}</li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <p className="text-[9px] uppercase tracking-[0.28em] text-slate-400">
                {m.run ? "Progress" : m.proposal.actions.length ? "What I'll do" : "Thinking"}
              </p>
              <ul className="mt-1 space-y-1">
                {(m.run ?? m.proposal.steps.map((s) => ({ label: s, state: "pending" as const })))
                  .map((s: any, i: number) => (
                    <StepRow key={i} label={s.label} state={s.state} detail={s.detail} />
                  ))}
              </ul>
            </div>
            {m.proposal.actions.some(isDestructive) && !m.settled && (
              <p className="text-[11px] text-amber-700">
                This replaces existing content in the lesson note. Approve it and I'll go ahead;
                your note's own undo still brings the original back.
              </p>
            )}
            {!m.settled && m.proposal.actions.length > 0 && (
              <div className="flex gap-2 pt-0.5">
                <Button size="sm" className="h-7 text-[11.5px] bg-slate-900 text-white hover:bg-slate-800" onClick={onApprove}>
                  Approve
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-[11.5px] text-slate-500 hover:text-slate-800" onClick={onReject}>
                  Cancel
                </Button>
              </div>
            )}
            {m.settled === "rejected" && (
              <p className="text-[11px] text-slate-400">Cancelled — nothing changed.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function CoPilotPanel({ bridgeRef, onClose }: Props) {
  const {
    messages, busy, send, approve, reject,
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
      className="h-full flex flex-col border-l border-slate-200 bg-white"
      aria-label="MathGPL Co-Pilot"
    >
      <header className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-b border-slate-200 bg-white">
        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-medium text-slate-900">MathGPL Co-Pilot — Active</p>
          <p className="text-[10px] text-slate-500 truncate">
            Mathematics comes from the MathGPL Math Engine
          </p>
        </div>
        <Button
          size="icon" variant="ghost"
          className="h-7 w-7 text-slate-400 hover:text-slate-700"
          onClick={onClose}
          aria-label="Close Co-Pilot"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </header>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2.5 bg-slate-50/70">
        {messages.map((m) => (
          <MessageBubble key={m.id} m={m} onApprove={() => approve(m)} onReject={() => reject(m)} />
        ))}

        {stage === "structure" && (
          <StructureCard counts={counts} onChange={setCounts} onConfirm={confirmStructure} locked={busy} />
        )}

        {stage === "material" && (
          <MaterialIntake onSubmit={provideMaterial} onSkip={skipMaterial} busy={busy} />
        )}

        {(stage === "building" || stage === "idle") && queue.length > 0 && (
          <BuildProgress
            queue={queue}
            onResume={resumeBuild}
            showResume={stage === "idle" && queue.some((q) => q.state !== "done")}
          />
        )}

        {busy && (
          <p className="text-[11.5px] text-slate-500 inline-flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            {STAGE_TEXT[stage] ?? "Thinking"}…
          </p>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-200 p-2.5 bg-white">
        <div className="flex items-end gap-1.5">
          <AutoTextarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
            minRows={2}
            maxRows={8}
            placeholder="Tell me what this lesson needs…"
            className="flex-1 rounded-xl bg-white border border-slate-300 px-2.5 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-500"
          />
          <Button
            size="icon" variant="ghost"
            className={`h-8 w-8 ${voice.listening ? "text-red-600" : "text-slate-400 hover:text-slate-700"}`}
            onClick={() => (voice.listening ? voice.stop() : voice.start())}
            aria-label={voice.listening ? "Stop recording" : "Dictate an instruction"}
          >
            {voice.transcribing ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : voice.listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          </Button>
          <Button
            size="icon"
            className="h-8 w-8 bg-slate-900 text-white hover:bg-slate-800"
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
