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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Sparkles, Loader2, Mic, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import {
  EDIT_SUGGESTIONS, SELECTION_KIND_LABELS,
} from "@/lib/lessonnotes/editSuggestions";
import type { SelectionKind } from "@/lib/lessonnotes/detectSelectionKind";

export interface AiEditTarget {
  text: string;
  kind: SelectionKind;
}

interface Props {
  open: boolean;
  target: AiEditTarget | null;
  /** Run AI with the given instruction; resolve with the proposed new text. */
  onGenerate: (instruction: string, target: AiEditTarget) => Promise<string>;
  /** Apply the proposed text back to the document. */
  onApply: (proposed: string) => void;
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
  const voice = useVoiceInput(setInstruction as any);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

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
    setBusy(true);
    setDiag(null);
    setRevealedCount(0);
    try {
      const result = await onGenerate(text, target);
      setProposed(result);
      const d = getDiagnostics?.() ?? null;
      setDiag(d);
      // Start reveal immediately with first row visible.
      if (d && d.items.length > 0) setRevealedCount(1);
    } finally {
      setBusy(false);
    }
  };

  const handleGenerate = async () => {
    if (!target) return;
    if (simpleMode) {
      setShowSuggestions(false);
      await runWith("");
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

  const handleApply = () => {
    if (proposed == null) return;
    onApply(proposed);
    onClose();
  };

  const handleCancel = () => {
    if (proposed != null) {
      // Back to instruction stage so the teacher can adjust the prompt.
      setProposed(null);
      return;
    }
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col p-0"
      >
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Edit
            {target && (
              <span className="text-[10px] uppercase tracking-wider text-foreground/55 font-normal">
                · {SELECTION_KIND_LABELS[target.kind]}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {/* Selected content preview (always visible). */}
        {target && (
          <div className="px-4 py-3 border-b bg-foreground/5">
            <p className="text-[10px] uppercase tracking-wider text-foreground/55 mb-1">Selected</p>
            <div className="text-sm max-h-24 overflow-auto whitespace-pre-wrap break-words">
              {renderPreview ? renderPreview(target.text) : target.text}
            </div>
          </div>
        )}

        {proposed == null ? (
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {simpleMode && simpleCaption && (
              <p className="text-xs text-foreground/65 leading-snug">{simpleCaption}</p>
            )}
            <textarea
              ref={inputRef}
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
              rows={simpleMode ? 3 : 4}
              className="w-full text-sm bg-transparent border border-foreground/15 rounded-md p-2 outline-none focus:border-foreground/40 placeholder:text-foreground/40 resize-none"
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={voice.listening ? voice.stop : voice.start}
                className={cn(
                  "p-1.5 rounded hover:bg-foreground/5 transition",
                  voice.listening && "text-red-500 animate-pulse bg-red-500/10",
                )}
                title={voice.listening ? "Stop voice" : "Speak"}
              >
                <Mic className="h-4 w-4" />
              </button>
              <span className="text-[10px] uppercase tracking-wider text-foreground/55">
                {voice.listening ? "listening…" : simpleMode ? "type · speak (optional)" : "type or speak"}
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
                          onClick={() => runWith(s)}
                          className="text-[11px] px-2 py-1 rounded border border-amber-500/40 hover:bg-amber-100/60 dark:hover:bg-amber-800/20 disabled:opacity-50 text-left"
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
                  <textarea
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    placeholder="Tell AI exactly what to change…"
                    rows={2}
                    className="w-full text-xs bg-transparent border border-foreground/15 rounded-md p-2 outline-none focus:border-foreground/40 placeholder:text-foreground/40 resize-none"
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
                  {renderPreview && target ? renderPreview(target.text) : target?.text}
                </div>
              </div>
              <div className="rounded-md border border-primary/30 bg-primary/5 p-2">
                <p className="text-[10px] uppercase tracking-wider text-primary mb-1">Proposed</p>
                <div className="text-sm whitespace-pre-wrap break-words">
                  {renderProposed ? renderProposed(proposed) :
                    renderPreview ? renderPreview(proposed) : proposed}
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
            <X className="h-3 w-3" /> {proposed != null ? "Back" : "Cancel"}
          </button>
          {proposed != null && (
            <button
              type="button"
              onClick={handleApply}
              className="ml-auto inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90"
            >
              <Sparkles className="h-3 w-3" /> Apply Changes
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
