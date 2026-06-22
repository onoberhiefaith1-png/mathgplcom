// Floating Number AI Assistant — permanent right-side workspace copilot.
// Captures highlighted content from the page (no copy/paste), supports
// multiple pinned selections, shows detected mathematical elements, and
// injects all selections into every prompt sent to the assistant.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Send,
  Sparkles,
  RotateCcw,
  Settings,
  Pin,
  PinOff,
  X,
  Eraser,
  Repeat,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { detectElements, type MathElement } from "@/lib/floating/elementDetector";
import type { LessonContext } from "@/lib/floating/lessonContext";

export interface AssistantClientAction {
  kind: "apply_chips" | "undo_last_change" | "approve_draft_law" | "reject_draft_law";
  payload: {
    line_id?: string;
    chips?: string[];
    scaffolds?: string[];
    verification_pass?: boolean;
    draft_id?: string;
    law_name?: string;
  };
}

export interface AssistantToolTrace {
  name: string;
  args: unknown;
  result: any;
}

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  toolTrace?: AssistantToolTrace[];
  pendingActions?: AssistantClientAction[];
}

export interface CapturedSelection {
  id: string;
  text: string;
  lineId?: string | null;
  pinned: boolean;
  ts: number;
}

interface Props {
  /** Active equation line id (drives tool calls when teacher hasn't highlighted text). */
  lineId: string | null;
  /** Captured highlights — managed by the parent page so selection capture stays in one place. */
  selections: CapturedSelection[];
  setSelections: React.Dispatch<React.SetStateAction<CapturedSelection[]>>;
  /** Approve a pending chip change → write to workspace. */
  onApproveApply: (payload: { lineId: string; chips: string[]; scaffolds?: string[] }) => void;
  /** Undo last change → restore previous chip snapshot. */
  onApproveUndo: (lineId: string) => void;
  /** Live lesson context — topic, problem, recent worked-example lines. */
  lessonContext?: LessonContext;
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? (crypto as any).randomUUID()
    : `m-${Math.random().toString(36).slice(2)}`;

const QUICK_ACTIONS: { label: string; prompt: string }[] = [
  { label: "Explain", prompt: "Explain the selected context in plain English." },
  { label: "Generate", prompt: "Generate floating numbers for the selected context." },
  { label: "Verify", prompt: "Verify the current chips against the selected context — coverage and reconstruction." },
  { label: "Restructure", prompt: "Restructure the selected context using a better-fitting law." },
  { label: "Apply Law", prompt: "Apply the most appropriate approved law to the selected context and show your reasoning." },
  { label: "New Law", prompt: "Propose a new draft law that would explain the selected context." },
  { label: "Compare", prompt: "Compare the selected contexts structurally and tell me how they relate." },
  { label: "Coverage", prompt: "Check element coverage for the selected context against the current chips." },
];

/* ─────────────────────── Detected Elements grouping ─────────────────────── */

const groupElements = (els: MathElement[]) => {
  const groups: Record<string, string[]> = {
    Variables: [],
    Coefficients: [],
    Operators: [],
    Functions: [],
    Scaffolds: [],
    Brackets: [],
    Equalities: [],
  };
  for (const e of els) {
    switch (e.kind) {
      case "variable":
        if (!groups.Variables.includes(e.value)) groups.Variables.push(e.value);
        break;
      case "number":
        groups.Coefficients.push(e.value);
        break;
      case "operator":
        if (!groups.Operators.includes(e.value)) groups.Operators.push(e.value);
        break;
      case "function-name":
        if (!groups.Functions.includes(e.value)) groups.Functions.push(e.value);
        break;
      case "fraction":
        groups.Scaffolds.push(`frac(${e.value})`);
        break;
      case "radical":
        groups.Scaffolds.push(`√(${e.value})`);
        break;
      case "power":
        groups.Scaffolds.push(`^(${e.value})`);
        break;
      case "subscript":
        groups.Scaffolds.push(`_(${e.value})`);
        break;
      case "integral":
        groups.Scaffolds.push("∫");
        break;
      case "summation":
        groups.Scaffolds.push("∑");
        break;
      case "matrix":
        groups.Scaffolds.push("matrix");
        break;
      case "bracket-open":
      case "bracket-close":
        groups.Brackets.push(e.value);
        break;
      case "equality":
        groups.Equalities.push(e.value);
        break;
      default:
        break;
    }
  }
  return groups;
};

const guessStructure = (els: MathElement[]): string => {
  const has = (k: MathElement["kind"]) => els.some((e) => e.kind === k);
  if (has("integral")) return "Integral";
  if (has("summation")) return "Summation";
  if (has("matrix")) return "Matrix";
  if (has("fraction")) return "Rational";
  if (has("radical")) return "Radical";
  if (has("function-name")) return "Function expression";
  if (has("power") && has("variable")) return "Polynomial";
  if (has("variable")) return "Algebraic";
  if (has("number")) return "Numeric";
  return "Expression";
};

export const AssistantPanel = ({
  lineId,
  selections,
  setSelections,
  onApproveApply,
  onApproveUndo,
  lessonContext,
}: Props) => {
  const navigate = useNavigate();
  const { notebookId, subsectionId } = useParams<{ notebookId: string; subsectionId: string }>();
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text:
        "Hi — I'm your Floating Number AI Assistant. Highlight any equation, scaffold, or chip on the left and I'll pick it up automatically. Then tell me what to do.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [replaceMode, setReplaceMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /* ───────────── Context management ───────────── */

  const togglePin = (id: string) =>
    setSelections((prev) => prev.map((s) => (s.id === id ? { ...s, pinned: !s.pinned } : s)));

  const removeSelection = (id: string) =>
    setSelections((prev) => prev.filter((s) => s.id !== id));

  const clearContext = () =>
    setSelections((prev) => prev.filter((s) => s.pinned));

  /* ───────────── Detected elements (most recent item) ───────────── */
  const latest = selections[selections.length - 1];
  const detected = useMemo(() => {
    if (!latest) return null;
    const els = detectElements(latest.text);
    return { groups: groupElements(els), structure: guessStructure(els) };
  }, [latest]);

  /* ───────────── Send ───────────── */

  const send = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? input).trim();
      if (!text || busy) return;
      const userDisplay =
        selections.length > 0
          ? `${text}\n\n— with ${selections.length} selection${selections.length === 1 ? "" : "s"} attached`
          : text;
      const userMsg: AssistantMessage = { id: newId(), role: "user", text: userDisplay };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setBusy(true);
      try {
        const history = messages.slice(-12).map((m) => ({ role: m.role, content: m.text }));
        const payloadSelections = selections.map((s) => ({
          id: s.id,
          text: s.text,
          lineId: s.lineId ?? null,
        }));
        const primarySelection = selections[0]?.text ?? null;
        const primaryLineId = selections[0]?.lineId ?? lineId ?? null;
        const { data, error } = await supabase.functions.invoke("floating-assistant", {
          body: {
            message: text,
            selection: primarySelection,
            selections: payloadSelections,
            lineId: primaryLineId,
            history,
          },
        });
        if (error) throw error;
        const d = data as {
          reply: string;
          toolTrace?: AssistantToolTrace[];
          clientActions?: AssistantClientAction[];
        };
        const reply: AssistantMessage = {
          id: newId(),
          role: "assistant",
          text: d.reply || "(no reply)",
          toolTrace: d.toolTrace,
          pendingActions: d.clientActions,
        };
        setMessages((prev) => [...prev, reply]);
      } catch (e: any) {
        toast({ title: "Assistant error", description: e?.message ?? String(e), variant: "destructive" });
        setMessages((prev) => [
          ...prev,
          { id: newId(), role: "assistant", text: `⚠️ ${e?.message ?? String(e)}` },
        ]);
      } finally {
        setBusy(false);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    },
    [input, busy, messages, selections, lineId],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const approveAction = (msgId: string, action: AssistantClientAction) => {
    if (action.kind === "apply_chips") {
      const lid = String(action.payload.line_id ?? "");
      const chips = Array.isArray(action.payload.chips) ? action.payload.chips.map(String) : [];
      if (!lid || chips.length === 0) {
        toast({ title: "Cannot apply", description: "Missing line id or chips.", variant: "destructive" });
        return;
      }
      if (action.payload.verification_pass !== true) {
        toast({
          title: "Verification did not pass",
          description: "Ask the assistant to retry or restructure before approving.",
          variant: "destructive",
        });
        return;
      }
      onApproveApply({ lineId: lid, chips, scaffolds: action.payload.scaffolds });
      toast({ title: "Chips applied", description: `Line updated with ${chips.length} chips.` });
    } else if (action.kind === "undo_last_change") {
      const lid = String(action.payload.line_id ?? "");
      if (!lid) return;
      onApproveUndo(lid);
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, pendingActions: m.pendingActions?.filter((a) => a !== action) } : m,
      ),
    );
  };

  return (
    <div
      className="flex flex-col h-full border-l"
      style={{ background: "hsl(38 35% 95%)", borderColor: "hsl(220 15% 60% / 0.25)" }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex items-center gap-2"
        style={{ borderColor: "hsl(220 15% 60% / 0.25)", background: "hsl(38 38% 96%)" }}
      >
        <Sparkles className="h-4 w-4" style={{ color: "hsl(220 35% 18%)" }} />
        <div className="text-sm font-semibold" style={{ color: "hsl(220 35% 18%)" }}>
          Floating Number AI
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              setMessages([
                { id: "welcome", role: "assistant", text: "New conversation. What should I work on?" },
              ])
            }
            className="p-1.5 rounded hover:bg-foreground/5"
            title="New conversation"
          >
            <RotateCcw className="h-3.5 w-3.5 text-foreground/55" />
          </button>
          <button
            type="button"
            onClick={() =>
              navigate(`/lesson-notes/${notebookId}/floating/${subsectionId}/ai-settings`)
            }
            className="p-1.5 rounded hover:bg-foreground/5"
            title="AI Settings & Knowledge Base"
          >
            <Settings className="h-3.5 w-3.5 text-foreground/55" />
          </button>
        </div>
      </div>

      {/* Selected Context — clear, readable, multi-card */}
      <div
        className="border-b max-h-[42vh] overflow-y-auto"
        style={{
          borderColor: "hsl(220 15% 60% / 0.2)",
          background: "hsl(38 40% 98%)",
        }}
      >
        <div className="px-3 pt-3 pb-1.5 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.25em] font-semibold text-foreground/65">
            Selected Context
          </span>
          <span className="text-[10px] text-foreground/45">
            {selections.length === 0 ? "none" : `${selections.length} item${selections.length === 1 ? "" : "s"}`}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setReplaceMode((v) => !v)}
              className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1"
              style={
                replaceMode
                  ? { background: "hsl(220 35% 18%)", color: "hsl(38 38% 96%)" }
                  : { color: "hsl(220 35% 18%)", border: "1px solid hsl(220 15% 60% / 0.35)" }
              }
              title="When on, next highlight replaces the most recent unpinned item"
            >
              <Repeat className="h-3 w-3" /> Replace
            </button>
            <button
              type="button"
              onClick={clearContext}
              disabled={selections.length === 0}
              className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1 disabled:opacity-30"
              style={{ color: "hsl(220 35% 18%)", border: "1px solid hsl(220 15% 60% / 0.35)" }}
              title="Clear all unpinned selections"
            >
              <Eraser className="h-3 w-3" /> Clear
            </button>
          </div>
        </div>

        {selections.length === 0 ? (
          <div className="px-3 pb-3 text-[12px] italic text-foreground/45">
            Highlight any equation, scaffold, or chip on the left to capture it here automatically.
          </div>
        ) : (
          <div className="px-3 pb-3 space-y-1.5">
            {selections.map((s, idx) => (
              <div
                key={s.id}
                className="rounded-md px-2.5 py-2 flex items-start gap-2"
                style={{
                  background: "hsl(0 0% 100%)",
                  border: s.pinned
                    ? "1px solid hsl(40 85% 50%)"
                    : "1px solid hsl(220 15% 60% / 0.35)",
                }}
              >
                <span
                  className="text-[10px] font-semibold mt-0.5 tabular-nums"
                  style={{ color: "hsl(220 35% 40%)" }}
                >
                  [{idx + 1}]
                </span>
                <pre
                  className="flex-1 text-[13px] whitespace-pre-wrap break-words leading-snug font-mono"
                  style={{ color: "hsl(220 35% 18%)", margin: 0 }}
                >
                  {s.text}
                </pre>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => togglePin(s.id)}
                    className="p-1 rounded hover:bg-foreground/5"
                    title={s.pinned ? "Unpin" : "Pin — survives Clear"}
                  >
                    {s.pinned ? (
                      <PinOff className="h-3 w-3" style={{ color: "hsl(40 85% 42%)" }} />
                    ) : (
                      <Pin className="h-3 w-3 text-foreground/55" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSelection(s.id)}
                    className="p-1 rounded hover:bg-foreground/5"
                    title="Remove"
                  >
                    <X className="h-3 w-3 text-foreground/55" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Detected Elements — based on the most recent item */}
        {detected && (
          <details className="px-3 pb-3" open>
            <summary className="text-[10px] uppercase tracking-[0.25em] font-semibold text-foreground/65 cursor-pointer select-none">
              Detected Elements · <span className="normal-case tracking-normal text-foreground/55">{detected.structure}</span>
            </summary>
            <div className="mt-2 space-y-1 text-[12px]" style={{ color: "hsl(220 35% 18%)" }}>
              {Object.entries(detected.groups).map(([label, vals]) =>
                vals.length === 0 ? null : (
                  <div key={label} className="flex gap-2">
                    <span className="text-foreground/55 w-[78px] shrink-0">{label}:</span>
                    <span className="font-mono break-words">{vals.join(", ")}</span>
                  </div>
                ),
              )}
            </div>
          </details>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className="max-w-[88%] rounded-lg px-3 py-2 text-sm leading-relaxed"
              style={
                m.role === "user"
                  ? { background: "hsl(220 35% 18%)", color: "hsl(38 38% 96%)" }
                  : { background: "hsl(38 38% 96%)", border: "1px solid hsl(220 15% 60% / 0.25)" }
              }
            >
              <div className="whitespace-pre-wrap">{m.text}</div>

              {m.toolTrace && m.toolTrace.length > 0 && (
                <details className="mt-2 text-[11px] opacity-80">
                  <summary className="cursor-pointer select-none">
                    {m.toolTrace.length} tool call{m.toolTrace.length === 1 ? "" : "s"}
                  </summary>
                  <div className="mt-1 space-y-1">
                    {m.toolTrace.map((t, i) => {
                      const v = (t.result as any)?.verification;
                      return (
                        <div
                          key={i}
                          className="rounded p-1.5"
                          style={{ background: "hsl(220 15% 60% / 0.08)" }}
                        >
                          <div className="font-mono">{t.name}</div>
                          {v && (
                            <div className="mt-0.5">
                              {v.status === "PASS" ? "✓" : "✗"} {v.coveragePct}% coverage
                              {!v.exactMatch && " · reconstruction mismatch"}
                              {v.missing?.length > 0 && (
                                <div className="text-rose-700">missing: {v.missing.join(", ")}</div>
                              )}
                            </div>
                          )}
                          {(t.result as any)?.chips && (
                            <div className="mt-0.5 font-mono">
                              chips: [{((t.result as any).chips as string[]).join(" | ")}]
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}

              {m.pendingActions && m.pendingActions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.pendingActions.map((a, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => approveAction(m.id, a)}
                      className="text-[11px] px-2 py-1 rounded-md"
                      style={{
                        background:
                          a.kind === "apply_chips" && a.payload.verification_pass
                            ? "hsl(150 60% 38%)"
                            : "hsl(220 35% 18%)",
                        color: "hsl(38 38% 96%)",
                      }}
                    >
                      {a.kind === "apply_chips"
                        ? `Approve & apply ${a.payload.chips?.length ?? 0} chips`
                        : "Approve undo"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div
              className="rounded-lg px-3 py-2 text-sm inline-flex items-center gap-2"
              style={{ background: "hsl(38 38% 96%)", border: "1px solid hsl(220 15% 60% / 0.25)" }}
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
            </div>
          </div>
        )}
      </div>

      {/* Quick action chips */}
      <div
        className="px-3 pt-2 pb-1 border-t flex flex-wrap gap-1"
        style={{ borderColor: "hsl(220 15% 60% / 0.2)" }}
      >
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={() => send(a.prompt)}
            disabled={busy}
            className="text-[11px] px-2 py-0.5 rounded-md hover:bg-foreground/5 disabled:opacity-40"
            style={{ color: "hsl(220 35% 18%)", border: "1px solid hsl(220 15% 60% / 0.3)" }}
            title={a.prompt}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Composer */}
      <div className="border-t p-3" style={{ borderColor: "hsl(220 15% 60% / 0.25)" }}>
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              selections.length > 0
                ? `Tell the AI what to do with the ${selections.length} selection${selections.length === 1 ? "" : "s"}…`
                : "Highlight something on the left, then ask…"
            }
            rows={2}
            className="flex-1 resize-none rounded-md border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
            style={{ borderColor: "hsl(220 15% 60% / 0.3)" }}
          />
          <button
            type="button"
            onClick={() => send()}
            disabled={!input.trim() || busy}
            className="rounded-md px-3 py-2 text-sm inline-flex items-center gap-1.5 disabled:opacity-40"
            style={{ background: "hsl(220 35% 18%)", color: "hsl(38 38% 96%)" }}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssistantPanel;
