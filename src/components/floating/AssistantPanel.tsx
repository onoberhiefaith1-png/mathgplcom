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
  Eye,
  Check,
} from "lucide-react";
import { useNavigate, useParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { renderMathInline } from "@/lib/notebook/mathRender";
import type { LessonContext } from "@/lib/floating/lessonContext";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { AutoTextarea } from "@/components/lessonnotes/AutoTextarea";

export type LineUpdateOp =
  | "move_filler"
  | "add_filler"
  | "remove_filler"
  | "add_container"
  | "remove_container"
  | "set_arrangement"
  | "replace_line";

export interface AssistantClientAction {
  kind:
    | "apply_chips"
    | "undo_last_change"
    | "approve_draft_law"
    | "reject_draft_law"
    | "apply_line_update"
    | "analyse_structure";
  payload: {
    line_id?: string;
    chips?: string[];
    scaffolds?: string[];
    verification_pass?: boolean;
    draft_id?: string;
    law_name?: string;
    // apply_line_update / analyse_structure
    op?: LineUpdateOp;
    from_index?: number;
    to_index?: number;
    value?: string | null;
    index?: number | null;
    container?: string | null;
    arrangement?: number[];
    fillers?: string[];
    containers?: string[];
    reason?: string;
    // analyse_structure extras
    equation?: string;
    detected_terms?: string[];
    applicable_laws?: { id: string; why?: string }[];
    reasoning?: string;
    patch?: { fillers?: string[]; containers?: string[]; arrangement?: number[] };
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
  kind: "document";
  filename: string;
  mime: string;
  /** base64 (no data: prefix). For inline TXT we still base64-encode for uniformity. */
  data: string;
  /** Plain text already extracted client-side, if any (TXT). */
  text?: string;
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

export interface LineUpdatePayload {
  lineId: string;
  op: LineUpdateOp;
  from_index?: number;
  to_index?: number;
  value?: string | null;
  index?: number | null;
  container?: string | null;
  arrangement?: number[];
  fillers?: string[];
  containers?: string[];
}

interface Props {
  lineId: string | null;
  activeHighlight: ActiveHighlight | null;
  onClearHighlight: () => void;
  onApproveApply: (payload: { lineId: string; chips: string[]; scaffolds?: string[] }) => void;
  onApproveUndo: (lineId: string) => void;
  onApplyLineUpdate?: (payload: LineUpdatePayload) => void;
  lessonContext?: LessonContext;
}


const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? (crypto as any).randomUUID()
    : `m-${Math.random().toString(36).slice(2)}`;

// Editor-first quick actions. The teacher highlights a chip / line, then
// taps one of these (or speaks naturally). Generation lives at the bottom
// as a secondary action — this AI is primarily an editing assistant.
const QUICK_ACTIONS: { label: string; prompt: string }[] = [
  { label: "Change this to…", prompt: "Change the highlighted floating number to " },
  { label: "Keep as one", prompt: "Keep the highlighted expression together as one floating number — do not split it." },
  { label: "Remove this", prompt: "Remove the highlighted floating number." },
  { label: "Move left", prompt: "Move the highlighted floating number one position to the left." },
  { label: "Move right", prompt: "Move the highlighted floating number one position to the right." },
  { label: "Remove bracket", prompt: "Remove the bracket around the highlighted expression." },
  { label: "Add bracket", prompt: "Wrap the highlighted expression in brackets." },
  { label: "Undo", prompt: "Undo the last change on this line." },
  { label: "Regenerate this line", prompt: "Regenerate the floating numbers for the active line from scratch." },
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


export const AssistantPanel = ({
  lineId,
  activeHighlight,
  onClearHighlight,
  onApproveApply,
  onApproveUndo,
  onApplyLineUpdate,
  lessonContext,
}: Props) => {

  const navigate = useNavigate();
  const { notebookId, subsectionId } = useParams<{ notebookId: string; subsectionId: string }>();
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text:
        "I'm your floating-number editor. The generator already laid out a first pass — tell me what to fix and I'll change it for you. Address things naturally: \"on line 6, change +4 to +4x\", \"put √ as the 5th floating number on line 4\", \"keep 1/4 as one fraction\", \"remove the bracket on line 2\". You can also highlight a chip and just say \"move this left\" or \"delete this\". I'll show a preview — one tap on Apply Changes commits it.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<AssistantAttachment[]>([]);
  const [previewOpen, setPreviewOpen] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Live voice dictation — browser SpeechRecognition. As the teacher speaks,
  // interim text streams into the textarea; on stop, the final transcript is
  // committed. Vibration gives haptic feedback on start/stop where supported.
  const { listening: recording, start: startVoice, stop: stopVoice, reset: resetVoice } =
    useVoiceInput(setInput as any);

  const startRecording = () => {
    try { (navigator as any).vibrate?.(40); } catch { /* noop */ }
    startVoice();
  };
  const stopRecording = () => {
    try { (navigator as any).vibrate?.([20, 30, 20]); } catch { /* noop */ }
    stopVoice();
  };

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

  /* Voice dictation lives in useVoiceInput above (browser SpeechRecognition). */


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
      resetVoice();
      setPendingAttachments([]);
      setBusy(true);

      try {
        const history = messages.slice(-12).map((m) => ({ role: m.role, content: m.text }));
        const docAtts = sentAttachments;
        const { data, error } = await supabase.functions.invoke("floating-assistant", {
          body: {
            message: promptText,
            workspace: "floating_number",
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
          },
        });
        if (error) {
          // supabase-js wraps non-2xx responses; the structured body lives on context.
          let body: any = null;
          try {
            const ctx: any = (error as any).context;
            if (ctx && typeof ctx.json === "function") body = await ctx.json();
            else if (ctx?.body) body = typeof ctx.body === "string" ? JSON.parse(ctx.body) : ctx.body;
          } catch { /* ignore */ }
          const err = body?.error;
          if (err && typeof err === "object") {
            const niceMsg = err.message || "The AI couldn't process that request.";
            const tail = err.detail ? `\n\nDetails: ${err.detail}` : "";
            throw new Error(`${niceMsg}${tail}`);
          }
          throw error;
        }
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
        const msg = e?.message ?? String(e);
        toast({ title: "Assistant error", description: msg, variant: "destructive" });
        setMessages((prev) => [
          ...prev,
          { id: newId(), role: "assistant", text: `⚠️ ${msg}` },
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
    } else if (action.kind === "apply_line_update") {
      const lid = String(action.payload.line_id ?? "");
      const op = action.payload.op as LineUpdateOp | undefined;
      if (!lid || !op) {
        toast({ title: "Cannot apply", description: "Missing line id or op.", variant: "destructive" });
        return;
      }
      if (!onApplyLineUpdate) {
        toast({ title: "Workspace control unavailable", description: "This page can't apply targeted edits yet.", variant: "destructive" });
        return;
      }
      onApplyLineUpdate({
        lineId: lid,
        op,
        from_index: action.payload.from_index,
        to_index: action.payload.to_index,
        value: action.payload.value ?? null,
        index: action.payload.index ?? null,
        container: action.payload.container ?? null,
        arrangement: action.payload.arrangement,
        fillers: action.payload.fillers,
        containers: action.payload.containers,
      });
      toast({ title: "Applied", description: `Line ${lid.slice(0, 6)} updated (${op}).` });
    } else if (action.kind === "analyse_structure") {
      const lid = String(action.payload.line_id ?? "");
      const patch = action.payload.patch ?? {};
      if (!lid || !patch.fillers?.length) {
        toast({ title: "Nothing to apply", description: "Analysis had no recommended structure.", variant: "destructive" });
        return;
      }
      if (!onApplyLineUpdate) {
        toast({ title: "Workspace control unavailable", variant: "destructive" });
        return;
      }
      onApplyLineUpdate({
        lineId: lid,
        op: "replace_line",
        fillers: patch.fillers,
        containers: patch.containers ?? [],
        arrangement: patch.arrangement ?? [],
      });
      toast({ title: "Analysis applied", description: `Line ${lid.slice(0, 6)} restructured.` });
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
      <FileText className="h-3 w-3" />
      <span className="font-mono">{a.filename}</span>
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
    const lineTag = String(action.payload.line_id ?? "").slice(0, 6);
    const opLabel = (op?: string): string => {
      switch (op) {
        case "move_filler": return `move filler ${action.payload.from_index} → ${action.payload.to_index}`;
        case "add_filler": return `add filler "${action.payload.value ?? ""}"${action.payload.container ? ` + container ${action.payload.container}` : ""}`;
        case "remove_filler": return `remove filler ${action.payload.value != null ? `"${action.payload.value}"` : `#${action.payload.index ?? "?"}`}`;
        case "add_container": return `add container ${action.payload.container ?? ""}`;
        case "remove_container": return `remove container ${action.payload.container ?? ""}`;
        case "set_arrangement": return `set arrangement [${(action.payload.arrangement ?? []).join(",")}]`;
        case "replace_line": return `replace line with ${(action.payload.fillers ?? []).length} fillers`;
        default: return op ?? "update";
      }
    };
    const reason = String(action.payload.reason ?? "").trim();
    const title =
      action.kind === "apply_chips"
        ? (reason || `Apply ${action.payload.chips?.length ?? 0} chip${(action.payload.chips?.length ?? 0) === 1 ? "" : "s"} to line ${lineTag}`)
        : action.kind === "undo_last_change"
        ? (reason || `Undo last edit on line ${lineTag}`)
        : action.kind === "approve_draft_law"
        ? `Proposed new law: ${action.payload.law_name ?? "draft"}`
        : action.kind === "reject_draft_law"
        ? `Reject draft law: ${action.payload.law_name ?? "draft"}`
        : action.kind === "apply_line_update"
        ? (reason || `${opLabel(action.payload.op)} on line ${lineTag}`)
        : (reason || `Analysis: line ${lineTag}`);
    const approveLabel =
      action.kind === "apply_chips" ? "Apply Changes"
      : action.kind === "undo_last_change" ? "Apply Undo"
      : action.kind === "approve_draft_law" ? "Approve Law"
      : action.kind === "reject_draft_law" ? "Confirm Reject"
      : action.kind === "apply_line_update" ? "Apply Changes"
      : "Apply Analysis";

    const blocked = action.kind === "apply_chips" && action.payload.verification_pass !== true;
    return (
      <div
        key={idx}
        className="mt-2 rounded-md p-2"
        style={{ border: `1px solid ${C.border}`, background: C.bg, color: C.text }}
      >
        <div className="flex items-center gap-2">
          <div className="text-[12px] font-semibold flex-1 min-w-0 truncate">{title}</div>
          {(action.kind === "apply_chips" ||
            action.kind === "undo_last_change" ||
            action.kind === "apply_line_update" ||
            action.kind === "analyse_structure") && (
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
        {open && action.kind === "apply_line_update" && (
          <div className="mt-2 text-[12px] space-y-1" style={{ color: C.textSubtle }}>
            <div><span className="font-semibold">op:</span> {action.payload.op}</div>
            {action.payload.reason && <div><span className="font-semibold">reason:</span> {action.payload.reason}</div>}
            {action.payload.fillers && action.payload.fillers.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {action.payload.fillers.map((c, i) => (
                  <span key={i} className="px-2 py-0.5 rounded text-[13px]" style={{ background: C.codeBg, border: `1px solid ${C.border}`, color: C.text }}>
                    {renderMathInline(c, `${key}-lu-${i}`)}
                  </span>
                ))}
              </div>
            )}
            {action.payload.containers && action.payload.containers.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {action.payload.containers.map((c, i) => (
                  <span key={i} className="px-2 py-0.5 rounded text-[12px]" style={{ background: C.codeBg, border: `1px dashed ${C.borderStrong}` }}>
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        {open && action.kind === "analyse_structure" && (
          <div className="mt-2 text-[12px] space-y-1.5" style={{ color: C.text }}>
            {action.payload.equation && (
              <div><span className="font-semibold">equation:</span> {renderMathInline(action.payload.equation, `${key}-eq`)}</div>
            )}
            {action.payload.detected_terms && action.payload.detected_terms.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <span className="font-semibold mr-1">terms:</span>
                {action.payload.detected_terms.map((t, i) => (
                  <span key={i} className="px-1.5 py-0.5 rounded text-[12px]" style={{ background: C.codeBg, border: `1px solid ${C.border}` }}>
                    {renderMathInline(t, `${key}-t-${i}`)}
                  </span>
                ))}
              </div>
            )}
            {action.payload.applicable_laws && action.payload.applicable_laws.length > 0 && (
              <div>
                <span className="font-semibold">laws:</span>{" "}
                {action.payload.applicable_laws.map((l, i) => (
                  <span key={i} className="mr-1.5">{l.id}{l.why ? ` (${l.why})` : ""}</span>
                ))}
              </div>
            )}
            {action.payload.patch?.fillers && action.payload.patch.fillers.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <span className="font-semibold mr-1">recommended:</span>
                {action.payload.patch.fillers.map((c, i) => (
                  <span key={i} className="px-2 py-0.5 rounded text-[13px]" style={{ background: C.codeBg, border: `1px solid ${C.border}` }}>
                    {renderMathInline(c, `${key}-rec-${i}`)}
                  </span>
                ))}
              </div>
            )}
            {action.payload.reasoning && (
              <div className="text-[12px]" style={{ color: C.textSubtle }}>{action.payload.reasoning}</div>
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
          <AutoTextarea
            textareaRef={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            minRows={3}
            maxRows={10}
            className="flex-1 rounded border px-3 py-2 text-sm leading-relaxed focus:outline-hidden"
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
              className={`p-2 rounded ${recording ? "animate-pulse" : ""}`}
              style={{
                color: recording ? C.bg : C.text,
                background: recording ? C.danger : C.bg,
                border: `1px solid ${recording ? C.danger : C.borderStrong}`,
                boxShadow: recording ? `0 0 0 4px rgba(185,28,28,0.18)` : undefined,
              }}
              title={recording ? "Listening… tap to stop" : "Tap to speak"}
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
