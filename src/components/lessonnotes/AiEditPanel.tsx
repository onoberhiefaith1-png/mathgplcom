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
}

export function AiEditPanel({
  open, target, onGenerate, onApply, onClose, renderPreview,
  simpleMode = false, simpleCaption, generateLabel, renderProposed,
}: Props) {
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [proposed, setProposed] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const voice = useVoiceInput(setInstruction as any);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Reset when the panel opens for a fresh selection.
  useEffect(() => {
    if (!open) return;
    setInstruction("");
    setProposed(null);
    setShowSuggestions(false);
    // Autofocus the input.
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open, target?.text]);

  const suggestions = useMemo(
    () => (target ? EDIT_SUGGESTIONS[target.kind] ?? [] : []),
    [target],
  );

  const runWith = async (text: string) => {
    if (!target) return;
    setBusy(true);
    try {
      const result = await onGenerate(text, target);
      setProposed(result);
    } finally {
      setBusy(false);
    }
  };

  const handleGenerate = async () => {
    if (!target) return;
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
              placeholder="Tell AI what you want to do…"
              rows={4}
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
                {voice.listening ? "listening…" : "type or speak"}
              </span>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={busy}
                className="ml-auto inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Generate
              </button>
            </div>

            {showSuggestions && !busy && suggestions.length > 0 && (
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
                  {renderPreview ? renderPreview(proposed) : proposed}
                </div>
              </div>
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
