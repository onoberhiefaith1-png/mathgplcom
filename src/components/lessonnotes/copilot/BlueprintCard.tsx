// Stage 4 of the fixed Copilot procedure — the LESSON DRAFT.
//
// Nothing is written into the lesson note until this draft is approved. Every
// item carries its ACTUAL question, editable in place, and each item can be
// revised by instruction, deleted, moved or duplicated by another of its kind.
// Approving it builds the full lesson, each question keeping its own solution.

import { useState } from "react";
import { ArrowRight, Check, ChevronDown, ChevronUp, Pencil, Plus, Shapes, Trash2, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import AutoTextarea from "@/components/lessonnotes/AutoTextarea";
import { carriesQuestion, type BuildItem } from "@/lib/lessonnotes/copilot/procedure";
import type { SectionKind } from "@/lib/lessonnotes/sectionKinds";

interface Props {
  queue: BuildItem[];
  busy?: boolean;
  onEdit: (key: string, text: string) => void;
  onRevise: (key: string, instruction: string) => void;
  onApprove: () => void;
  onEditQuestion?: (key: string, question: string) => void;
  onDeleteItem?: (key: string) => void;
  onAddItem?: (kind: SectionKind, afterKey?: string) => void;
  onMoveItem?: (key: string, dir: -1 | 1) => void;
}

const BlueprintCard = ({
  queue, busy, onEdit, onRevise, onApprove,
  onEditQuestion, onDeleteItem, onAddItem, onMoveItem,
}: Props) => {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
  const [questionDraft, setQuestionDraft] = useState("");
  const [revising, setRevising] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");

  if (!queue.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2 shadow-sm">
      <p className="text-[9px] uppercase tracking-[0.28em] text-slate-500">Lesson draft</p>
      <p className="text-[11.5px] text-slate-600">
        These are the actual questions. Edit any question, add or remove one, reorder them, or approve
        the draft and I'll write the full lesson — each question keeping its own worked solution.
      </p>

      <ul className="divide-y divide-slate-150">
        {queue.map((item, i) => {
          const hasQuestion = carriesQuestion(item.kind);
          return (
          <li key={item.key} className="py-2 space-y-1.5">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-slate-900">
                  {item.label}
                  {item.needsDiagram && (
                    <span className="ml-1.5 inline-flex items-center gap-1 align-middle rounded-full bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-medium text-slate-700">
                      <Shapes className="h-2.5 w-2.5" /> diagram
                    </span>
                  )}
                  {item.asset3d && (
                    <span className="ml-1.5 align-middle rounded-full bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-medium text-slate-700">
                      3D: {item.asset3d}
                    </span>
                  )}
                  {item.withSolution && (
                    <span className="ml-1.5 align-middle rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9.5px] font-medium text-emerald-700">
                      with solution
                    </span>
                  )}
                  {item.solutionStale && (
                    <span className="ml-1.5 align-middle rounded-full bg-amber-50 px-1.5 py-0.5 text-[9.5px] font-medium text-amber-700">
                      solution to redo
                    </span>
                  )}
                </p>

                {/* The actual question — the thing the teacher approves. */}
                {hasQuestion && (
                  editingQuestion === item.key ? (
                    <div className="mt-1 space-y-1.5">
                      <AutoTextarea
                        value={questionDraft}
                        onChange={(e) => setQuestionDraft(e.target.value)}
                        minRows={2}
                        maxRows={10}
                        placeholder={`The question for ${item.label}`}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[12.5px] text-slate-900 outline-none focus:border-slate-600"
                      />
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          className="h-6 gap-1 text-[11px] bg-slate-900 text-white hover:bg-slate-800"
                          onClick={() => { onEditQuestion?.(item.key, questionDraft); setEditingQuestion(null); }}
                        >
                          <Check className="h-3 w-3" /> Keep question
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          className="h-6 gap-1 text-[11px] text-slate-500"
                          onClick={() => setEditingQuestion(null)}
                        >
                          <X className="h-3 w-3" /> Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                      <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400">Question</p>
                      <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-900 whitespace-pre-wrap">
                        {item.question || "Not written yet — edit it or ask me to write it."}
                      </p>
                    </div>
                  )
                )}

                {editing === item.key ? (
                  <div className="mt-1 space-y-1.5">
                    <AutoTextarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      minRows={2}
                      maxRows={8}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[12.5px] text-slate-900 outline-none focus:border-slate-600"
                    />
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        className="h-6 gap-1 text-[11px] bg-slate-900 text-white hover:bg-slate-800"
                        onClick={() => { onEdit(item.key, draft.trim()); setEditing(null); }}
                      >
                        <Check className="h-3 w-3" /> Keep
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        className="h-6 gap-1 text-[11px] text-slate-500"
                        onClick={() => setEditing(null)}
                      >
                        <X className="h-3 w-3" /> Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-0.5 text-[12px] leading-relaxed text-slate-700 whitespace-pre-wrap">
                    {item.plan || "Planned from the subtopic and the structure above."}
                  </p>
                )}

                {item.note && editing !== item.key && (
                  <p className="mt-0.5 text-[11px] italic text-slate-500">{item.note}</p>
                )}

                {revising === item.key && (
                  <div className="mt-1.5 space-y-1.5">
                    <AutoTextarea
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                      minRows={1}
                      maxRows={5}
                      placeholder={`What should change about ${item.label}?`}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[12.5px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-600"
                    />
                    <div className="flex gap-1.5">
                      <Button
                        size="sm" disabled={busy || !instruction.trim()}
                        className="h-6 text-[11px] bg-slate-900 text-white hover:bg-slate-800"
                        onClick={() => {
                          onRevise(item.key, instruction.trim());
                          setInstruction("");
                          setRevising(null);
                        }}
                      >
                        Revise
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        className="h-6 text-[11px] text-slate-500"
                        onClick={() => { setRevising(null); setInstruction(""); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {editing !== item.key && revising !== item.key && editingQuestion !== item.key && (
                <span className="flex shrink-0 gap-0.5">
                  {hasQuestion && onEditQuestion && (
                    <Button
                      size="icon" variant="ghost" disabled={busy}
                      className="h-6 w-6 text-slate-400 hover:text-slate-900"
                      onClick={() => { setEditingQuestion(item.key); setQuestionDraft(item.question ?? ""); }}
                      aria-label={`Edit the question for ${item.label}`}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    size="icon" variant="ghost" disabled={busy}
                    className="h-6 w-6 text-slate-400 hover:text-slate-900"
                    onClick={() => setRevising(item.key)}
                    aria-label={`Ask me to change ${item.label}`}
                  >
                    <Wand2 className="h-3 w-3" />
                  </Button>
                  {onMoveItem && (
                    <>
                      <Button
                        size="icon" variant="ghost" disabled={busy || i === 0}
                        className="h-6 w-6 text-slate-400 hover:text-slate-900"
                        onClick={() => onMoveItem(item.key, -1)}
                        aria-label={`Move ${item.label} up`}
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon" variant="ghost" disabled={busy || i === queue.length - 1}
                        className="h-6 w-6 text-slate-400 hover:text-slate-900"
                        onClick={() => onMoveItem(item.key, 1)}
                        aria-label={`Move ${item.label} down`}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                  {onAddItem && (
                    <Button
                      size="icon" variant="ghost" disabled={busy}
                      className="h-6 w-6 text-slate-400 hover:text-slate-900"
                      onClick={() => onAddItem(item.kind, item.key)}
                      aria-label={`Add another ${item.label} after this one`}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  )}
                  {onDeleteItem && queue.length > 1 && (
                    <Button
                      size="icon" variant="ghost" disabled={busy}
                      className="h-6 w-6 text-slate-400 hover:text-rose-600"
                      onClick={() => onDeleteItem(item.key)}
                      aria-label={`Remove ${item.label}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </span>
              )}
            </div>
          </li>
          );
        })}
      </ul>

      <Button
        size="sm" disabled={busy}
        className="h-7 w-full gap-1.5 text-[11.5px] bg-slate-900 text-white hover:bg-slate-800"
        onClick={onApprove}
      >
        Build the lesson <ArrowRight className="h-3 w-3" />
      </Button>
    </div>
  );
};

export default BlueprintCard;
