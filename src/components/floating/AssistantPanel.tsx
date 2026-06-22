// Floating Number AI Assistant — permanent right-side chat panel.
// Receives the teacher's CURRENT_SELECTION (highlighted equation line) and
// drives the workspace via tool calls returned by the floating-assistant
// edge function.

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles, RotateCcw, Settings } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface AssistantClientAction {
  kind: "apply_chips" | "undo_last_change";
  payload: {
    line_id?: string;
    chips?: string[];
    scaffolds?: string[];
    verification_pass?: boolean;
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

interface Props {
  selection: string | null;
  lineId: string | null;
  /** Approve a pending chip change → write to workspace. */
  onApproveApply: (payload: { lineId: string; chips: string[]; scaffolds?: string[] }) => void;
  /** Undo last change → restore previous chip snapshot. */
  onApproveUndo: (lineId: string) => void;
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? (crypto as any).randomUUID()
    : `m-${Math.random().toString(36).slice(2)}`;

export const AssistantPanel = ({ selection, lineId, onApproveApply, onApproveUndo }: Props) => {
  const navigate = useNavigate();
  const { notebookId, subsectionId } = useParams<{ notebookId: string; subsectionId: string }>();
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text:
        "Hi — I'm your Floating Number AI Assistant. Highlight any equation line on the left and tell me what to do: 'generate floating numbers', 'keep a and b together', 'verify all elements', 'explain the law'.",
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

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    const userMsg: AssistantMessage = { id: newId(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setBusy(true);
    try {
      const history = messages.slice(-12).map((m) => ({ role: m.role, content: m.text }));
      const { data, error } = await supabase.functions.invoke("floating-assistant", {
        body: {
          message: text,
          selection,
          lineId,
          history,
        },
      });
      if (error) throw error;
      const d = data as { reply: string; toolTrace?: AssistantToolTrace[]; clientActions?: AssistantClientAction[] };
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
  }, [input, busy, messages, selection, lineId]);

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
    // Mark message actions consumed
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
                {
                  id: "welcome",
                  role: "assistant",
                  text: "New conversation. What should I work on?",
                },
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

      {/* Current selection strip */}
      <div
        className="px-4 py-2 text-[11px] border-b"
        style={{ borderColor: "hsl(220 15% 60% / 0.15)", background: "hsl(38 38% 96% / 0.6)" }}
      >
        <span className="uppercase tracking-[0.2em] text-foreground/55">Current selection:&nbsp;</span>
        <span className="font-mono text-foreground/85">
          {selection ? selection : <span className="italic text-foreground/40">none — click a line on the left</span>}
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[88%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                m.role === "user" ? "text-foreground" : "text-foreground"
              }`}
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

      {/* Composer */}
      <div className="border-t p-3" style={{ borderColor: "hsl(220 15% 60% / 0.25)" }}>
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={selection ? "Tell the AI what to do…" : "Highlight a line, then ask…"}
            rows={2}
            className="flex-1 resize-none rounded-md border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
            style={{ borderColor: "hsl(220 15% 60% / 0.3)" }}
          />
          <button
            type="button"
            onClick={send}
            disabled={!input.trim() || busy}
            className="rounded-md px-3 py-2 text-sm inline-flex items-center gap-1.5 disabled:opacity-40"
            style={{ background: "hsl(220 35% 18%)", color: "hsl(38 38% 96%)" }}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send
          </button>
        </div>
        <div className="mt-1.5 text-[10px] text-foreground/45">
          Try: "generate floating numbers", "keep a and b together", "verify coverage", "undo last change"
        </div>
      </div>
    </div>
  );
};

export default AssistantPanel;
