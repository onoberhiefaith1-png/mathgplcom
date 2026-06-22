// Floating Number AI Assistant — permanent right-side workspace copilot.
// White background, black text. Live single-selection sync by default;
// Multi-Selection mode lets the teacher pin and stack selections.

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

export type SelectionMode = "single" | "multi";

interface Props {
  lineId: string | null;
  selections: CapturedSelection[];
  setSelections: React.Dispatch<React.SetStateAction<CapturedSelection[]>>;
  selectionMode: SelectionMode;
  setSelectionMode: React.Dispatch<React.SetStateAction<SelectionMode>>;
  onApproveApply: (payload: { lineId: string; chips: string[]; scaffolds?: string[] }) => void;
  onApproveUndo: (lineId: string) => void;
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

/* ─────────────────────── Color tokens (fixed, no transparency) ─────────────────────── */
const C = {
  bg: "#FFFFFF",
  text: "#000000",
  textSubtle: "#374151", // dark grey but still high contrast
  border: "#E5E7EB",
  borderStrong: "#D1D5DB",
  hover: "#F3F4F6",
  codeBg: "#F9FAFB",
  userAccent: "#2563EB",
  assistantAccent: "#111827",
  pinned: "#B45309",
  ok: "#047857",
  danger: "#B91C1C",
  info: "#1D4ED8",
};

export const AssistantPanel = ({
  lineId,
  selections,
  setSelections,
  selectionMode,
  setSelectionMode,
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
            lessonContext: lessonContext ?? null,
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
    [input, busy, messages, selections, lineId, lessonContext],
  );

  const approveDraftLaw = useCallback(async (draftId: string) => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) throw new Error("Not signed in");
      const { data: draft, error: dErr } = await supabase
        .from("floating_law_drafts")
        .select("*")
        .eq("id", draftId)
        .maybeSingle();
      if (dErr || !draft) throw dErr ?? new Error("Draft not found");
      const { error: insErr } = await supabase.from("floating_law_library").insert({
        owner_id: uid,
        name: (draft as any).name,
        rule: (draft as any).rule,
        reason: (draft as any).reason,
        conditions: (draft as any).conditions ?? {},
        exceptions: (draft as any).exceptions ?? [],
        examples: (draft as any).examples ?? [],
        lesson_topics: (draft as any).lesson_topics ?? [],
        tags: (draft as any).tags ?? [],
        version: 1,
      } as any);
      if (insErr) throw insErr;
      await supabase.from("floating_law_drafts").update({ status: "approved" } as any).eq("id", draftId);
      toast({ title: "Law approved", description: (draft as any).name });
    } catch (e: any) {
      toast({ title: "Could not approve law", description: e?.message ?? String(e), variant: "destructive" });
    }
  }, []);

  const rejectDraftLaw = useCallback(async (draftId: string) => {
    try {
      await supabase.from("floating_law_drafts").update({ status: "rejected" } as any).eq("id", draftId);
      toast({ title: "Draft law rejected" });
    } catch (e: any) {
      toast({ title: "Could not reject", description: e?.message ?? String(e), variant: "destructive" });
    }
  }, []);

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
    } else if (action.kind === "approve_draft_law") {
      const did = String(action.payload.draft_id ?? "");
      if (!did) return;
      void approveDraftLaw(did);
    } else if (action.kind === "reject_draft_law") {
      const did = String(action.payload.draft_id ?? "");
      if (!did) return;
      void rejectDraftLaw(did);
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, pendingActions: m.pendingActions?.filter((a) => a !== action) } : m,
      ),
    );
  };

  const isMulti = selectionMode === "multi";

  return (
    <div
      className="flex flex-col h-full border-l"
      style={{ background: C.bg, borderColor: C.border, color: C.text }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex items-center gap-2"
        style={{ borderColor: C.border, background: C.bg }}
      >
        <Sparkles className="h-4 w-4" style={{ color: C.text }} />
        <div className="text-sm font-semibold" style={{ color: C.text }}>
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
            className="p-1.5 rounded"
            style={{ color: C.text }}
            title="New conversation"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() =>
              navigate(`/lesson-notes/${notebookId}/floating/${subsectionId}/ai-settings`)
            }
            className="p-1.5 rounded"
            style={{ color: C.text }}
            title="AI Settings & Knowledge Base"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Lesson Context strip */}
      {lessonContext && (lessonContext.topic || lessonContext.problem) && (
        <div
          className="px-3 py-2 border-b text-[11px]"
          style={{ borderColor: C.border, background: C.bg, color: C.text }}
        >
          <div className="flex items-center gap-2">
            <span className="text-[9px] uppercase tracking-[0.25em] font-semibold" style={{ color: C.textSubtle }}>
              Lesson
            </span>
            {lessonContext.topic && <span className="font-semibold">{lessonContext.topic}</span>}
            {lessonContext.sectionKind && (
              <span style={{ color: C.textSubtle }}>· {lessonContext.sectionKind}</span>
            )}
            <span className="ml-auto text-[9px] tabular-nums" style={{ color: C.textSubtle }}>
              {lessonContext.recentExamples.length} line
              {lessonContext.recentExamples.length === 1 ? "" : "s"}
            </span>
          </div>
          {lessonContext.problem && (
            <div className="mt-1 text-[11px] font-mono" style={{ color: C.text }}>
              {lessonContext.problem}
            </div>
          )}
        </div>
      )}

      {/* Current / Selected Context */}
      <div
        className="border-b max-h-[42vh] overflow-y-auto"
        style={{ borderColor: C.border, background: C.bg }}
      >
        <div className="px-3 pt-3 pb-1.5 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-[0.25em] font-semibold" style={{ color: C.text }}>
            {isMulti ? "Selected Context" : "Current Selection"}
          </span>
          <span className="text-[10px]" style={{ color: C.textSubtle }}>
            {selections.length === 0
              ? "none"
              : `${selections.length} item${selections.length === 1 ? "" : "s"}`}
          </span>
          <div className="ml-auto flex items-center gap-1">
            {/* Single | Multi segmented control */}
            <div
              className="inline-flex rounded overflow-hidden"
              style={{ border: `1px solid ${C.borderStrong}` }}
            >
              <button
                type="button"
                onClick={() => setSelectionMode("single")}
                className="text-[10px] px-2 py-0.5"
                style={
                  !isMulti
                    ? { background: C.text, color: C.bg }
                    : { background: C.bg, color: C.text }
                }
                title="Single — every new highlight replaces the previous one"
              >
                Single
              </button>
              <button
                type="button"
                onClick={() => setSelectionMode("multi")}
                className="text-[10px] px-2 py-0.5"
                style={
                  isMulti
                    ? { background: C.text, color: C.bg }
                    : { background: C.bg, color: C.text }
                }
                title="Multi — stack highlights; pin to keep them across changes"
              >
                Multi
              </button>
            </div>
            {isMulti && (
              <button
                type="button"
                onClick={clearContext}
                disabled={selections.length === 0}
                className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1 disabled:opacity-40"
                style={{ color: C.text, border: `1px solid ${C.borderStrong}`, background: C.bg }}
                title="Clear all unpinned selections"
              >
                <Eraser className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
        </div>

        {selections.length === 0 ? (
          <div className="px-3 pb-3 text-[12px]" style={{ color: C.textSubtle }}>
            No selection — highlight any equation on the left and it will appear here instantly.
          </div>
        ) : (
          <div className="px-3 pb-3 space-y-1.5">
            {selections.map((s, idx) => (
              <div
                key={s.id}
                className="rounded-md px-2.5 py-2 flex items-start gap-2"
                style={{
                  background: C.codeBg,
                  border: s.pinned ? `1px solid ${C.pinned}` : `1px solid ${C.border}`,
                  color: C.text,
                }}
              >
                {isMulti && (
                  <span
                    className="text-[10px] font-semibold mt-0.5 tabular-nums"
                    style={{ color: C.text }}
                  >
                    [{idx + 1}]
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <pre
                    className="text-[13px] whitespace-pre-wrap break-words leading-snug font-mono"
                    style={{ color: C.text, margin: 0 }}
                  >
                    {s.text}
                  </pre>
                  {s.lineId && (
                    <div className="mt-1 text-[10px] font-mono" style={{ color: C.textSubtle }}>
                      line: {s.lineId.slice(0, 8)}
                    </div>
                  )}
                </div>
                {isMulti && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => togglePin(s.id)}
                      className="p-1 rounded"
                      style={{ color: s.pinned ? C.pinned : C.text }}
                      title={s.pinned ? "Unpin" : "Pin — survives Clear"}
                    >
                      {s.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSelection(s.id)}
                      className="p-1 rounded"
                      style={{ color: C.text }}
                      title="Remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Detected Elements */}
        {detected && (
          <details className="px-3 pb-3" open>
            <summary
              className="text-[10px] uppercase tracking-[0.25em] font-semibold cursor-pointer select-none"
              style={{ color: C.text }}
            >
              Detected Elements ·{" "}
              <span className="normal-case tracking-normal" style={{ color: C.textSubtle }}>
                {detected.structure}
              </span>
            </summary>
            <div className="mt-2 space-y-1 text-[12px]" style={{ color: C.text }}>
              {Object.entries(detected.groups).map(([label, vals]) =>
                vals.length === 0 ? null : (
                  <div key={label} className="flex gap-2">
                    <span className="w-[78px] shrink-0" style={{ color: C.textSubtle }}>
                      {label}:
                    </span>
                    <span className="font-mono break-words" style={{ color: C.text }}>
                      {vals.join(", ")}
                    </span>
                  </div>
                ),
              )}
            </div>
          </details>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        style={{ background: C.bg }}
      >
        {messages.map((m) => (
          <div key={m.id} className="flex flex-col">
            <div
              className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-0.5"
              style={{ color: m.role === "user" ? C.userAccent : C.assistantAccent }}
            >
              {m.role === "user" ? "You" : "Assistant"}
            </div>
            <div
              className="rounded px-3 py-2 text-sm leading-relaxed"
              style={{
                background: C.bg,
                color: C.text,
                borderLeft: `2px solid ${m.role === "user" ? C.userAccent : C.assistantAccent}`,
                border: `1px solid ${C.border}`,
                borderLeftWidth: 2,
                borderLeftColor: m.role === "user" ? C.userAccent : C.assistantAccent,
              }}
            >
              <div className="whitespace-pre-wrap" style={{ color: C.text }}>
                {m.text}
              </div>

              {m.toolTrace && m.toolTrace.length > 0 && (
                <details className="mt-2 text-[11px]" style={{ color: C.text }}>
                  <summary className="cursor-pointer select-none" style={{ color: C.textSubtle }}>
                    {m.toolTrace.length} tool call{m.toolTrace.length === 1 ? "" : "s"}
                  </summary>
                  <div className="mt-1 space-y-1">
                    {m.toolTrace.map((t, i) => {
                      const v = (t.result as any)?.verification;
                      return (
                        <div
                          key={i}
                          className="rounded p-1.5"
                          style={{ background: C.codeBg, border: `1px solid ${C.border}`, color: C.text }}
                        >
                          <div className="font-mono">{t.name}</div>
                          {v && (
                            <div className="mt-0.5">
                              {v.status === "PASS" ? "✓" : "✗"} {v.coveragePct}% coverage
                              {!v.exactMatch && " · reconstruction mismatch"}
                              {v.missing?.length > 0 && (
                                <div style={{ color: C.danger }}>
                                  missing: {v.missing.join(", ")}
                                </div>
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
                  {m.pendingActions.map((a, i) => {
                    const label =
                      a.kind === "apply_chips"
                        ? `Approve & apply ${a.payload.chips?.length ?? 0} chips`
                        : a.kind === "undo_last_change"
                        ? "Approve undo"
                        : a.kind === "approve_draft_law"
                        ? `Approve law: ${a.payload.law_name ?? "draft"}`
                        : a.kind === "reject_draft_law"
                        ? `Reject law: ${a.payload.law_name ?? "draft"}`
                        : "Approve";
                    const bg =
                      a.kind === "apply_chips" && a.payload.verification_pass
                        ? C.ok
                        : a.kind === "approve_draft_law"
                        ? C.info
                        : a.kind === "reject_draft_law"
                        ? C.danger
                        : C.text;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => approveAction(m.id, a)}
                        className="text-[11px] px-2 py-1 rounded"
                        style={{ background: bg, color: C.bg }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div
              className="rounded px-3 py-2 text-sm inline-flex items-center gap-2"
              style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }}
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
            </div>
          </div>
        )}
      </div>

      {/* Quick action chips */}
      <div
        className="px-3 pt-2 pb-1 border-t flex flex-wrap gap-1"
        style={{ borderColor: C.border, background: C.bg }}
      >
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={() => send(a.prompt)}
            disabled={busy}
            className="text-[11px] px-2 py-0.5 rounded disabled:opacity-40"
            style={{ color: C.text, border: `1px solid ${C.borderStrong}`, background: C.bg }}
            title={a.prompt}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Composer */}
      <div className="border-t p-3" style={{ borderColor: C.border, background: C.bg }}>
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
            className="flex-1 resize-none rounded border px-3 py-2 text-sm focus:outline-none"
            style={{ borderColor: C.borderStrong, background: C.bg, color: C.text }}
          />
          <button
            type="button"
            onClick={() => send()}
            disabled={!input.trim() || busy}
            className="rounded px-3 py-2 text-sm inline-flex items-center gap-1.5 disabled:opacity-40"
            style={{ background: C.text, color: C.bg }}
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
