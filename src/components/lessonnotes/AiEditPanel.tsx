// AI Edit Panel — opens after the teacher chooses "AI Edit" from the
// selection toolbar. Two stages:
//   STAGE 1 — instruction:  input + voice + Generate (Mode A) OR
//             empty Generate → show kind-specific suggestion chips (Mode B).
//   STAGE 2 — preview:      side-by-side current vs proposed, with
//             Cancel / Apply Changes.
//
// The panel itself is renderer-agnostic — it talks to a parent via two
// callbacks (onGenerate, onApply) so the same component can be reused for
// the smartboard later.

import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Loader2, Mic, Square, X, Check, RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { VoiceWave } from "./VoiceWave";
import { AutoTextarea } from "./AutoTextarea";
import {
  EDIT_SUGGESTIONS, SELECTION_KIND_LABELS,
} from "@/lib/lessonnotes/editSuggestions";
import type { SelectionKind } from "@/lib/lessonnotes/detectSelectionKind";
import { sanitizePresentation } from "@/lib/lessonnotes/outputHygiene";
import { aiTextToNodes, hasStructuredAiContent } from "@/lib/lessonnotes/aiToNodes";
import { renderMathInline } from "@/lib/notebook/mathRender";

export interface AiEditTarget {
  text: string;
  kind: SelectionKind;
  json?: unknown;
}

interface Props {
  open: boolean;
  target: AiEditTarget | null;
  /** Run AI with the given instruction; resolve with the proposed new text. */
  onGenerate: (instruction: string, target: AiEditTarget, signal?: AbortSignal) => Promise<string>;
  /** Apply the proposed text back to the document. False keeps the preview open. */
  onApply: (proposed: string) => boolean | Promise<boolean>;
  onClose: () => void;
  /** Render a preview (current and proposed) — usually the math renderer. */
  renderPreview?: (text: string) => React.ReactNode;
  /**
   * One-click mode: hide the instruction textarea, voice, and suggestion
   * chips. Generate calls onGenerate("", target) directly and the preview
   * exposes a Regenerate button. Used by the floating-numbers page where
   * "AI Edit" always means "regenerate floating numbers for this line".
   */
  simpleMode?: boolean;
  /** Caption shown above the Generate button in simple mode. */
  simpleCaption?: string;
  /** Label for the primary action (defaults to "Generate"). */
  generateLabel?: string;
  /** Optional custom renderer for the proposed result (e.g. chips). */
  renderProposed?: (proposed: string) => React.ReactNode;
  /**
   * Optional diagnostic checklist (e.g. from floating-number AI Edit).
   * The panel reads it via a getter so the parent can refresh it after
   * each generation without re-creating the prop identity.
   */
  getDiagnostics?: () => AiEditDiagnostics | null;
}

export type AiEditDiagStatus = "pass" | "fail" | "fixed";
export interface AiEditDiagItem { id: string; label: string; status: AiEditDiagStatus; detail?: string }
export interface AiEditRecovery {
  reason: "structure_not_decomposed" | "law_violation" | "missing_terms" | "unknown";
  summary: string;
  hints: string[];
  suggestedInstructions: string[];
  canRevert: boolean;
}
export interface AiEditDiagnostics {
  status: "clean" | "fixed" | "unresolved";
  items: AiEditDiagItem[];
  recovery?: AiEditRecovery;
}

export function AiEditPanel({
  open, target, onGenerate, onApply, onClose, renderPreview,
  simpleMode = false, simpleCaption, generateLabel, renderProposed, getDiagnostics,
}: Props) {
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [proposed, setProposed] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [diag, setDiag] = useState<AiEditDiagnostics | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const voice = useVoiceInput(setInstruction as any);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const structuredPreview = (text: string) => aiTextToNodes(text).map((node, index) => {
    const child = node?.type === "paragraph" ? node.content?.[0] : node;
    if (child?.type === "mathStructure" && child.attrs?.kind === "matrix") {
      const attrs = child.attrs.attrs ?? {};
      const rows = Number(attrs.rows) || 1;
      const cols = Number(attrs.cols) || 1;
      const slots = child.content ?? [];
      return (
        <div key={index} className="my-2 inline-grid gap-x-4 gap-y-1 border-x-2 border-foreground px-2 py-1"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(2rem, auto))` }}>
          {Array.from({ length: rows * cols }, (_, i) => (
            <span key={i} className="text-center">{renderMathInline(slots[i]?.content?.[0]?.text ?? "")}</span>
          ))}
        </div>
      );
    }
    if (child?.type === "mathVisual" && child.attrs?.family === "smarttable") {
      const attrs = child.attrs.attrs ?? {};
      const headers: string[] = Array.isArray(attrs.headers) ? attrs.headers : [];
      const cells: string[][] = Array.isArray(attrs.cells) ? attrs.cells : [];
      return (
        <div key={index} className="my-2 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            {headers.length > 0 && <thead><tr>{headers.map((cell, i) => <th key={i} className="border border-foreground/30 p-1.5">{renderMathInline(cell)}</th>)}</tr></thead>}
            <tbody>{cells.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c} className="border border-foreground/30 p-1.5 text-center">{renderMathInline(cell)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
    }
    const source = node?.type === "mathBlock"
      ? node.attrs?.value
      : node?.content?.map((part: any) => part.text ?? part.attrs?.value ?? "").join("");
    return source ? <div key={index}>{renderPreview ? renderPreview(source) : source}</div> : null;
  });

  /** Never show raw syntax in a preview: structured proposals use the same
   * parser as Apply; plain text keeps the existing math renderer. */
  const safePreview = (text: string) => {
    if (hasStructuredAiContent(text)) return structuredPreview(text);
    const clean = sanitizePresentation(text ?? "");
    return renderPreview ? renderPreview(clean) : clean;
  };

  // Reset when the panel opens for a fresh selection.
  useEffect(() => {
    if (!open) return;
    setInstruction("");
    setProposed(null);
    setShowSuggestions(false);
    setDiag(null);
    setRevealedCount(0);
    // Autofocus the input.
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open, target?.text]);

  const suggestions = useMemo(
    () => (target ? EDIT_SUGGESTIONS[target.kind] ?? [] : []),
    [target],
  );

  // Reveal diagnostic rows one at a time for a "check, check, check" feel.
  useEffect(() => {
    if (!diag) return;
    if (revealedCount >= diag.items.length) return;
    const t = window.setTimeout(() => setRevealedCount((c) => c + 1), 280);
    return () => window.clearTimeout(t);
  }, [diag, revealedCount]);

  const runWith = async (text: string) => {
    if (!target) return;
    // A new request always supersedes the previous one.
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    setError(null);
    setDiag(null);
    setRevealedCount(0);
    try {
      const result = await onGenerate(text, target, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setProposed(result);
      const d = getDiagnostics?.() ?? null;
      setDiag(d);
      // Start reveal immediately with first row visible.
      if (d && d.items.length > 0) setRevealedCount(1);
    } catch (e: unknown) {
      if (ctrl.signal.aborted) return;
      // Failures, timeouts, quota — reported HERE only. The teacher's content
      // is never touched.
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "AI could not complete this edit.");
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      if (!ctrl.signal.aborted) setBusy(false);
    }
  };

  /** Stop an in-flight request without touching the note. */
  const cancelRequest = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  };

  const handleGenerate = async () => {
    if (!target) return;
    if (simpleMode) {
      setShowSuggestions(false);
      await runWith(instruction.trim());
      return;
    }
    if (instruction.trim()) {
      setShowSuggestions(false);
      await runWith(instruction.trim());
    } else {
      setShowSuggestions(true);
    }
  };

  const handlePickSuggestion = async (label: string) => {
    setInstruction(label);
    await runWith(label);
  };

  /** Accept — apply the proposal to exactly the selected range. */
  const handleApply = async () => {
    if (proposed == null) return;
    setError(null);
    try {
      const applied = await onApply(proposed);
      if (applied) onClose();
      else setError("The accepted edit could not replace the highlighted content. Your proposal is still here—highlight the content again and retry.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "The accepted edit could not be applied.");
    }
  };

  /** Edit again — keep the proposal in view and take a further instruction. */
  const handleEditAgain = () => {
    setProposed(null);
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  /** Cancel — leave the note exactly as it was. */
  const handleCancel = () => {
    cancelRequest();
    onClose();
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="AI Edit"
      // Non-modal on purpose: while AI works the teacher can still scroll,
      // type, save and navigate the lesson note behind this pane.
      className="fixed inset-y-0 right-0 z-40 w-full sm:w-[420px] max-w-full flex flex-col bg-background border-l border-foreground/15 shadow-2xl"
    >
      <div className="px-4 py-3 border-b flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-medium">AI Edit</h2>
        {target && (
          <span className="text-[10px] uppercase tracking-wider text-foreground/55">
            · {SELECTION_KIND_LABELS[target.kind]}
          </span>
        )}
        <button
          type="button"
          onClick={handleCancel}
          className="ml-auto p-1 rounded hover:bg-foreground/10"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

        {/* Selected content preview (always visible). */}
        {target && (
          <div className="px-4 py-3 border-b bg-foreground/5">
            <p className="text-[10px] uppercase tracking-wider text-foreground/55 mb-1">Selected</p>
            <div className="text-sm max-h-24 overflow-auto whitespace-pre-wrap break-words">
              {safePreview(target.text)}
            </div>
          </div>
        )}

        {error && (
          <div className="mx-4 mt-3 rounded-md border border-red-400/40 bg-red-50 dark:bg-red-950/20 p-3 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span className="flex-1">
              {error}
              <span className="block mt-1 text-[11px] opacity-80">
                Your content was not changed. Adjust the instruction and try again.
              </span>
            </span>
          </div>
        )}

        {proposed == null ? (
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {simpleMode && simpleCaption && (
              <p className="text-xs text-foreground/65 leading-snug">{simpleCaption}</p>
            )}
            <AutoTextarea
              textareaRef={inputRef}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              placeholder={
                simpleMode
                  ? "Optional: tell AI what to fix or how you want it…"
                  : "Tell AI what you want to do…"
              }
              minRows={simpleMode ? 3 : 4}
              maxRows={12}
              className="w-full text-sm leading-relaxed bg-transparent border border-foreground/15 rounded-md p-2 outline-hidden focus:border-foreground/40 placeholder:text-foreground/40"
            />

            {(voice.listening || voice.transcribing) && (
              <VoiceWave level={voice.level} seconds={voice.seconds} />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => (voice.listening ? voice.stop() : voice.start())}
                className={cn(
                  "p-1.5 rounded hover:bg-foreground/5 transition",
                  voice.listening && "text-red-500 animate-pulse bg-red-500/10",
                )}
                title={voice.listening ? "Stop recording" : "Record"}
              >
                {voice.listening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <span className="text-[10px] uppercase tracking-wider text-foreground/55">
                {voice.listening
                  ? "recording — tap to stop"
                  : voice.transcribing
                    ? "transcribing…"
                    : simpleMode ? "type · speak (optional)" : "type or speak"}
              </span>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={busy}
                className="ml-auto inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {generateLabel ?? "Generate"}
              </button>
            </div>

            {!simpleMode && showSuggestions && !busy && suggestions.length > 0 && (
              <div className="pt-2 border-t border-foreground/10 space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-foreground/55">
                  Suggestions for {SELECTION_KIND_LABELS[target!.kind]}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handlePickSuggestion(s)}
                      className="text-xs px-2 py-1 rounded border border-foreground/15 hover:bg-foreground/10"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {diag && diag.items.length > 0 && (
              <div className="rounded-md border border-foreground/15 p-3 space-y-1.5 bg-foreground/[0.02]">
                <p className="text-[10px] uppercase tracking-wider text-foreground/55 mb-1">
                  Smart check
                </p>
                {diag.items.slice(0, revealedCount).map((it) => {
                  const icon =
                    it.status === "pass" ? "✓" :
                    it.status === "fixed" ? "✦" : "✗";
                  const color =
                    it.status === "pass" ? "text-emerald-600" :
                    it.status === "fixed" ? "text-blue-600" : "text-red-600";
                  return (
                    <div key={it.id} className="flex items-start gap-2 text-xs">
                      <span className={cn("font-bold tabular-nums w-3", color)}>{icon}</span>
                      <div className="flex-1">
                        <span className={it.status === "fail" ? "text-foreground" : "text-foreground/80"}>
                          {it.status === "fixed" ? `Fixed: ${it.label}` : it.label}
                        </span>
                        {it.detail && it.status === "fail" && (
                          <span className="block text-[10px] text-foreground/55">{it.detail}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {revealedCount < diag.items.length && (
                  <div className="flex items-center gap-2 text-xs text-foreground/55">
                    <Loader2 className="h-3 w-3 animate-spin" /> checking…
                  </div>
                )}
                {revealedCount >= diag.items.length && (
                  <p className={cn(
                    "text-[11px] pt-1 mt-1 border-t border-foreground/10",
                    diag.status === "clean" && "text-emerald-700",
                    diag.status === "fixed" && "text-blue-700",
                    diag.status === "unresolved" && "text-amber-700",
                  )}>
                    {diag.status === "clean" && "All checks passed — floating numbers are correct."}
                    {diag.status === "fixed" && "Errors found and fixed. Review the chips below."}
                    {diag.status === "unresolved" && "Auto-fix could not resolve this line. Choose a recovery step below."}
                  </p>
                )}
              </div>
            )}

            {diag?.status === "unresolved" && diag.recovery && revealedCount >= diag.items.length && (
              <div className="rounded-md border border-amber-400/40 bg-amber-50/60 dark:bg-amber-900/10 p-3 space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold">
                  Recovery steps
                </p>
                <p className="text-xs text-foreground/80">{diag.recovery.summary}</p>
                {diag.recovery.hints.length > 0 && (
                  <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-foreground/75">
                    {diag.recovery.hints.map((h, i) => <li key={i}>{h}</li>)}
                  </ol>
                )}
                {diag.recovery.suggestedInstructions.length > 0 && (
                  <div className="pt-1 space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-foreground/55">
                      Try one of these
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {diag.recovery.suggestedInstructions.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          disabled={busy}
                          onClick={() => setInstruction(s)}
                          className={cn(
                            "text-[11px] px-2 py-1 rounded border border-amber-500/40 hover:bg-amber-100/60 dark:hover:bg-amber-800/20 disabled:opacity-50 text-left",
                            instruction.trim() === s && "bg-amber-100/80 dark:bg-amber-800/25",
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="pt-2 border-t border-amber-400/30 space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-foreground/55">
                    Or write your own instruction
                  </p>
                  <AutoTextarea
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    placeholder="Tell AI exactly what to change…"
                    minRows={3}
                    maxRows={10}
                    className="w-full text-xs leading-relaxed bg-transparent border border-foreground/15 rounded-md p-2 outline-hidden focus:border-foreground/40 placeholder:text-foreground/40"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={voice.listening ? voice.stop : voice.start}
                      className={cn(
                        "p-1 rounded hover:bg-foreground/5 transition",
                        voice.listening && "text-red-500 animate-pulse bg-red-500/10",
                      )}
                      title={voice.listening ? "Stop voice" : "Speak"}
                    >
                      <Mic className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={busy || !instruction.trim()}
                      onClick={() => runWith(instruction.trim())}
                      className="ml-auto inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      Regenerate
                    </button>
                  </div>
                </div>
                {diag.recovery.canRevert && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full text-[11px] px-2 py-1 rounded border border-foreground/20 hover:bg-foreground/5"
                  >
                    Keep current chips and close
                  </button>
                )}
              </div>
            )}

            <p className="text-[10px] uppercase tracking-wider text-foreground/55">Preview changes</p>
            <div className="grid grid-cols-1 gap-3">
              <div className="rounded-md border border-foreground/15 p-2">
                <p className="text-[10px] uppercase tracking-wider text-foreground/55 mb-1">Current</p>
                <div className="text-sm whitespace-pre-wrap break-words">
                  {target ? safePreview(target.text) : null}
                </div>
              </div>
              <div className="rounded-md border border-primary/30 bg-primary/5 p-2">
                <p className="text-[10px] uppercase tracking-wider text-primary mb-1">Proposed</p>
                <div className="text-sm whitespace-pre-wrap break-words">
                  {renderProposed ? renderProposed(proposed) :
                    safePreview(proposed)}
                </div>
              </div>
              {simpleMode && (
                <div className="flex">
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={busy}
                    className="ml-auto inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-foreground/20 hover:bg-foreground/5 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Regenerate
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="border-t px-4 py-3 flex items-center gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="text-xs px-3 py-1.5 rounded border border-foreground/15 hover:bg-foreground/10 inline-flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Cancel
          </button>
          {busy && (
            <button
              type="button"
              onClick={cancelRequest}
              className="ml-auto text-xs px-3 py-1.5 rounded border border-foreground/20 hover:bg-foreground/5 inline-flex items-center gap-1.5"
            >
              <Square className="h-3 w-3" /> Stop
            </button>
          )}
          {!busy && proposed != null && (
            <>
              <button
                type="button"
                onClick={handleEditAgain}
                className="ml-auto text-xs px-3 py-1.5 rounded border border-foreground/20 hover:bg-foreground/5 inline-flex items-center gap-1.5"
              >
                <RefreshCw className="h-3 w-3" /> Edit again
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90"
              >
                <Check className="h-3 w-3" /> Accept
              </button>
            </>
          )}
        </div>
    </div>
  );
}
