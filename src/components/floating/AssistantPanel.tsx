// Floating Number AI Assistant — ChatGPT-style chat surface.
// Inputs: typed prompt, highlighted equation from the page, voice notes,
// and document uploads (.pdf/.docx/.txt). Approval-gated "Proposed change"
// cards drive the page edits (apply_chips, undo, draft-law approval).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Send,
  Sparkles,
  RotateCcw,
  Settings,
  Paperclip,
  Mic,
  Square,
  X,
  FileText,
  AudioLines,
  Eye,
  Check,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { renderMathInline } from "@/lib/notebook/mathRender";
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

export interface ActiveHighlight {
  id: string;
  text: string;
  lineId?: string | null;
}

export interface AssistantAttachment {
  id: string;
  kind: "document" | "audio";
  filename: string;
  mime: string;
  /** base64 (no data: prefix). For inline TXT we still base64-encode for uniformity. */
  data: string;
  /** Plain text already extracted client-side, if any (TXT). */
  text?: string;
  /** Audio duration in seconds, for display. */
  durationSec?: number;
}

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  highlight?: ActiveHighlight | null;
  attachments?: AssistantAttachment[];
  toolTrace?: AssistantToolTrace[];
  pendingActions?: AssistantClientAction[];
}

interface Props {
  lineId: string | null;
  activeHighlight: ActiveHighlight | null;
  onClearHighlight: () => void;
  onApproveApply: (payload: { lineId: string; chips: string[]; scaffolds?: string[] }) => void;
  onApproveUndo: (lineId: string) => void;
  lessonContext?: LessonContext;
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? (crypto as any).randomUUID()
    : `m-${Math.random().toString(36).slice(2)}`;

const QUICK_ACTIONS: { label: string; prompt: string }[] = [
  { label: "Explain", prompt: "Explain the highlighted expression in plain English." },
  { label: "Generate", prompt: "Generate floating numbers for the highlighted expression." },
  { label: "Verify", prompt: "Verify current chips — coverage and reconstruction." },
  { label: "Restructure", prompt: "Restructure the highlighted expression using a better-fitting law." },
  { label: "Apply Law", prompt: "Apply the most appropriate approved law and show your reasoning." },
  { label: "New Law", prompt: "Propose a new draft law that explains the highlighted expression." },
  { label: "Compare", prompt: "Compare the highlighted expression with the previous example structurally." },
  { label: "Coverage", prompt: "Check element coverage of the current chips against the highlight." },
];

const C = {
  bg: "#FFFFFF",
  text: "#000000",
  textSubtle: "#374151",
  border: "#E5E7EB",
  borderStrong: "#D1D5DB",
  hover: "#F3F4F6",
  codeBg: "#F9FAFB",
  userBubble: "#EFF6FF",
  userAccent: "#2563EB",
  assistantAccent: "#111827",
  ok: "#047857",
  danger: "#B91C1C",
  info: "#1D4ED8",
};

const ACCEPT_DOCS = ".pdf,.docx,.txt,.md,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onload = () => {
      const s = String(r.result ?? "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.readAsDataURL(file);
  });

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onload = () => {
      const s = String(r.result ?? "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.readAsDataURL(blob);
  });

const formatDuration = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

export const AssistantPanel = ({
  lineId,
  activeHighlight,
  onClearHighlight,
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
        "Hi — I'm your Floating Number AI. Type a request, highlight something on the page, record a voice note, or attach a document. I can generate, restructure, verify, and apply changes directly to the floating number page after your approval.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<AssistantAttachment[]>([]);
  const [recording, setRecording] = useState(false);
  const [previewOpen, setPreviewOpen] = useState<Record<string, boolean>>({});
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /* ───────────── Attachments ───────────── */

  const onFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const out: AssistantAttachment[] = [];
    for (const f of Array.from(list)) {
      try {
        const data = await fileToBase64(f);
        const isTxt = /\.(txt|md)$/i.test(f.name) || f.type.startsWith("text/");
        let text: string | undefined;
        if (isTxt) {
          try { text = await f.text(); } catch { /* ignore */ }
        }
        out.push({
          id: newId(),
          kind: "document",
          filename: f.name,
          mime: f.type || (isTxt ? "text/plain" : "application/octet-stream"),
          data,
          text,
        });
      } catch (e: any) {
        toast({ title: "Could not read file", description: e?.message ?? String(e), variant: "destructive" });
      }
    }
    if (out.length) setPendingAttachments((prev) => [...prev, ...out]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeAttachment = (id: string) =>
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));

  /* ───────────── Voice ───────────── */

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        const data = await blobToBase64(blob);
        const dur = (Date.now() - recordStartRef.current) / 1000;
        setPendingAttachments((prev) => [
          ...prev,
          {
            id: newId(),
            kind: "audio",
            filename: `voice-${new Date().toISOString().slice(11, 19)}.webm`,
            mime: mr.mimeType || "audio/webm",
            data,
            durationSec: dur,
          },
        ]);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorderRef.current = mr;
      recordStartRef.current = Date.now();
      mr.start();
      setRecording(true);
    } catch (e: any) {
      toast({ title: "Microphone unavailable", description: e?.message ?? String(e), variant: "destructive" });
    }
  };

  const stopRecording = () => {
    try { recorderRef.current?.stop(); } catch { /* ignore */ }
    setRecording(false);
  };

  /* ───────────── Send ───────────── */

  const send = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? input).trim();
      if (!text && pendingAttachments.length === 0 && !activeHighlight) return;
      if (busy) return;
      const promptText = text || (activeHighlight ? "Work with this highlighted expression." : "Use the attached materials.");

      const sentAttachments = pendingAttachments;
      const sentHighlight = activeHighlight;

      const userMsg: AssistantMessage = {
        id: newId(),
        role: "user",
        text: promptText,
        highlight: sentHighlight ?? null,
        attachments: sentAttachments,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setPendingAttachments([]);
      setBusy(true);

      try {
        const history = messages.slice(-12).map((m) => ({ role: m.role, content: m.text }));
        const audioAtt = sentAttachments.find((a) => a.kind === "audio");
        const docAtts = sentAttachments.filter((a) => a.kind === "document");
        const { data, error } = await supabase.functions.invoke("floating-assistant", {
          body: {
            message: promptText,
            selection: sentHighlight?.text ?? null,
            lineId: sentHighlight?.lineId ?? lineId ?? null,
            history,
            lessonContext: lessonContext ?? null,
            attachments: docAtts.map((a) => ({
              filename: a.filename,
              mime: a.mime,
              data: a.data,
              text: a.text ?? null,
            })),
            audio: audioAtt
              ? { filename: audioAtt.filename, mime: audioAtt.mime, data: audioAtt.data }
              : null,
          },
        });
        if (error) throw error;
        const d = data as {
          reply: string;
          toolTrace?: AssistantToolTrace[];
          clientActions?: AssistantClientAction[];
        };
        // Clear the highlight chip once it's been consumed by a turn.
        if (sentHighlight) onClearHighlight();
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            text: d.reply || "(no reply)",
            toolTrace: d.toolTrace,
            pendingActions: d.clientActions,
          },
        ]);
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
    [input, busy, messages, pendingAttachments, activeHighlight, lineId, lessonContext, onClearHighlight],
  );

  /* ───────────── Draft law approve/reject ───────────── */

  const approveDraftLaw = useCallback(async (draftId: string) => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) throw new Error("Not signed in");
      const { data: draft, error: dErr } = await supabase
        .from("floating_law_drafts").select("*").eq("id", draftId).maybeSingle();
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
      toast({ title: "Applied", description: `Line updated with ${chips.length} chips.` });
    } else if (action.kind === "undo_last_change") {
      const lid = String(action.payload.line_id ?? "");
      if (lid) onApproveUndo(lid);
    } else if (action.kind === "approve_draft_law") {
      const did = String(action.payload.draft_id ?? "");
      if (did) void approveDraftLaw(did);
    } else if (action.kind === "reject_draft_law") {
      const did = String(action.payload.draft_id ?? "");
      if (did) void rejectDraftLaw(did);
    }
    dismissAction(msgId, action);
  };

  const dismissAction = (msgId: string, action: AssistantClientAction) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, pendingActions: m.pendingActions?.filter((a) => a !== action) } : m,
      ),
    );
  };

  const togglePreview = (key: string) =>
    setPreviewOpen((p) => ({ ...p, [key]: !p[key] }));

  /* ───────────── Render helpers ───────────── */

  const HighlightChip = ({ h, onClose }: { h: ActiveHighlight; onClose?: () => void }) => (
    <div
      className="rounded-md px-2.5 py-1.5 mb-1.5 flex items-start gap-2"
      style={{ background: C.codeBg, border: `1px solid ${C.border}`, color: C.text }}
    >
      <Sparkles className="h-3 w-3 mt-1 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[9px] uppercase tracking-[0.25em] font-semibold" style={{ color: C.textSubtle }}>
          Highlighted context{h.lineId ? ` · line ${h.lineId.slice(0, 6)}` : ""}
        </div>
        <div className="text-[14px] leading-snug mt-0.5" style={{ color: C.text }}>
          {renderMathInline(h.text, h.id)}
        </div>
      </div>
      {onClose && (
        <button type="button" onClick={onClose} className="p-0.5 rounded" title="Remove highlight">
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );

  const AttachmentChip = ({ a, onRemove }: { a: AssistantAttachment; onRemove?: () => void }) => (
    <div
      className="rounded-md px-2 py-1 inline-flex items-center gap-1.5 text-[12px]"
      style={{ background: C.codeBg, border: `1px solid ${C.border}`, color: C.text }}
    >
      {a.kind === "audio" ? <AudioLines className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
      <span className="font-mono">{a.filename}</span>
      {a.kind === "audio" && typeof a.durationSec === "number" && (
        <span style={{ color: C.textSubtle }}>· {formatDuration(a.durationSec)}</span>
      )}
      {onRemove && (
        <button type="button" onClick={onRemove} className="p-0.5 rounded" title="Remove">
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );

  const renderProposedChange = (msgId: string, action: AssistantClientAction, idx: number) => {
    const key = `${msgId}-${idx}`;
    const open = !!previewOpen[key];
    const title =
      action.kind === "apply_chips"
        ? `Proposed change: apply ${action.payload.chips?.length ?? 0} chip${(action.payload.chips?.length ?? 0) === 1 ? "" : "s"} to line ${String(action.payload.line_id ?? "").slice(0, 6)}`
        : action.kind === "undo_last_change"
        ? `Proposed change: undo last edit on line ${String(action.payload.line_id ?? "").slice(0, 6)}`
        : action.kind === "approve_draft_law"
        ? `Proposed new law: ${action.payload.law_name ?? "draft"}`
        : `Reject draft law: ${action.payload.law_name ?? "draft"}`;
    const approveLabel =
      action.kind === "apply_chips" ? "Approve & Apply"
      : action.kind === "undo_last_change" ? "Approve Undo"
      : action.kind === "approve_draft_law" ? "Approve Law"
      : "Confirm Reject";
    const blocked = action.kind === "apply_chips" && action.payload.verification_pass !== true;
    return (
      <div
        key={idx}
        className="mt-2 rounded-md p-2"
        style={{ border: `1px solid ${C.border}`, background: C.bg, color: C.text }}
      >
        <div className="flex items-center gap-2">
          <div className="text-[12px] font-semibold flex-1 min-w-0 truncate">{title}</div>
          {(action.kind === "apply_chips" || action.kind === "undo_last_change") && (
            <button
              type="button"
              onClick={() => togglePreview(key)}
              className="text-[11px] px-2 py-0.5 rounded inline-flex items-center gap-1"
              style={{ color: C.text, border: `1px solid ${C.borderStrong}` }}
            >
              <Eye className="h-3 w-3" /> {open ? "Hide" : "Show"} Preview
            </button>
          )}
        </div>
        {open && action.kind === "apply_chips" && (
          <div className="mt-2 space-y-1">
            <div className="flex flex-wrap gap-1">
              {(action.payload.chips ?? []).map((c, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded text-[13px]"
                  style={{ background: C.codeBg, border: `1px solid ${C.border}` }}
                >
                  {renderMathInline(c, `${key}-chip-${i}`)}
                </span>
              ))}
            </div>
            {action.payload.scaffolds && action.payload.scaffolds.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {action.payload.scaffolds.map((s, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded text-[12px]"
                    style={{ background: C.codeBg, border: `1px dashed ${C.borderStrong}`, color: C.textSubtle }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        {blocked && (
          <div className="mt-1 text-[11px]" style={{ color: C.danger }}>
            Verification did not pass — ask the AI to restructure before approving.
          </div>
        )}
        <div className="mt-2 flex gap-1.5">
          <button
            type="button"
            onClick={() => approveAction(msgId, action)}
            disabled={blocked}
            className="text-[12px] px-2.5 py-1 rounded inline-flex items-center gap-1 disabled:opacity-40"
            style={{ background: C.text, color: C.bg }}
          >
            <Check className="h-3 w-3" /> {approveLabel}
          </button>
          <button
            type="button"
            onClick={() => dismissAction(msgId, action)}
            className="text-[12px] px-2.5 py-1 rounded"
            style={{ color: C.text, border: `1px solid ${C.borderStrong}`, background: C.bg }}
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => {
              dismissAction(msgId, action);
              inputRef.current?.focus();
            }}
            className="text-[12px] px-2.5 py-1 rounded"
            style={{ color: C.text, border: `1px solid ${C.borderStrong}`, background: C.bg }}
          >
            Modify…
          </button>
        </div>
      </div>
    );
  };

  /* ───────────── Layout ───────────── */

  const placeholder = useMemo(() => {
    if (activeHighlight) return "Tell the AI what to do with the highlighted expression…";
    if (pendingAttachments.length > 0) return "Add instructions for the attached material…";
    return "Ask anything — generate, verify, restructure, apply laws, propose a new law…";
  }, [activeHighlight, pendingAttachments]);

  return (
    <div
      className="flex flex-col h-full border-l"
      style={{ background: C.bg, borderColor: C.border, color: C.text }}
    >
      {/* Top bar */}
      <div
        className="px-4 py-3 border-b flex items-center gap-2"
        style={{ borderColor: C.border, background: C.bg }}
      >
        <Sparkles className="h-4 w-4" />
        <div className="text-sm font-semibold">Floating Number AI</div>
        {lessonContext?.topic && (
          <span
            className="ml-2 text-[10px] px-2 py-0.5 rounded-full"
            style={{ background: C.codeBg, border: `1px solid ${C.border}`, color: C.text }}
            title={lessonContext.problem ?? undefined}
          >
            {lessonContext.topic}
          </span>
        )}
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

      {/* Conversation */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        style={{ background: C.bg }}
      >
        {messages.map((m) => {
          const isUser = m.role === "user";
          return (
            <div key={m.id} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
              <div
                className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-1"
                style={{ color: isUser ? C.userAccent : C.assistantAccent }}
              >
                {isUser ? "You" : "Assistant"}
              </div>

              {/* User: highlight + attachments above the bubble */}
              {isUser && m.highlight && (
                <div className="w-full max-w-[92%]">
                  <HighlightChip h={m.highlight} />
                </div>
              )}
              {isUser && m.attachments && m.attachments.length > 0 && (
                <div className="w-full max-w-[92%] mb-1.5 flex flex-wrap gap-1.5">
                  {m.attachments.map((a) => <AttachmentChip key={a.id} a={a} />)}
                </div>
              )}

              <div
                className="rounded-md px-3 py-2 text-sm leading-relaxed max-w-[92%]"
                style={{
                  background: isUser ? C.userBubble : C.bg,
                  color: C.text,
                  border: `1px solid ${C.border}`,
                  borderLeft: `3px solid ${isUser ? C.userAccent : C.assistantAccent}`,
                }}
              >
                <div className="whitespace-pre-wrap">{m.text}</div>

                {m.toolTrace && m.toolTrace.length > 0 && (
                  <details className="mt-2 text-[11px]">
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
                            style={{ background: C.codeBg, border: `1px solid ${C.border}` }}
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
                  <div>
                    {m.pendingActions.map((a, i) => renderProposedChange(m.id, a, i))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

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

      {/* Composer */}
      <div className="border-t" style={{ borderColor: C.border, background: C.bg }}>
        {/* Pending context preview (highlight + attachments to be sent on next turn) */}
        {(activeHighlight || pendingAttachments.length > 0) && (
          <div className="px-3 pt-2">
            {activeHighlight && (
              <HighlightChip h={activeHighlight} onClose={onClearHighlight} />
            )}
            {pendingAttachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {pendingAttachments.map((a) => (
                  <AttachmentChip key={a.id} a={a} onRemove={() => removeAttachment(a.id)} />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="px-3 pt-2 flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            rows={2}
            className="flex-1 resize-none rounded border px-3 py-2 text-sm focus:outline-none"
            style={{ borderColor: C.borderStrong, background: C.bg, color: C.text }}
          />
          <div className="flex flex-col gap-1">
            <input
              ref={fileRef}
              type="file"
              multiple
              accept={ACCEPT_DOCS}
              onChange={(e) => onFiles(e.target.files)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="p-2 rounded"
              style={{ color: C.text, border: `1px solid ${C.borderStrong}`, background: C.bg }}
              title="Attach document (PDF, DOCX, TXT)"
            >
              <Paperclip className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={recording ? stopRecording : startRecording}
              className="p-2 rounded"
              style={{
                color: recording ? C.bg : C.text,
                background: recording ? C.danger : C.bg,
                border: `1px solid ${recording ? C.danger : C.borderStrong}`,
              }}
              title={recording ? "Stop recording" : "Record voice note"}
            >
              {recording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => send()}
              disabled={busy || (!input.trim() && pendingAttachments.length === 0 && !activeHighlight)}
              className="p-2 rounded disabled:opacity-40"
              style={{ background: C.text, color: C.bg }}
              title="Send"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Quick actions */}
        <div className="px-3 pt-2 pb-3 flex flex-wrap gap-1">
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
      </div>
    </div>
  );
};

export default AssistantPanel;
