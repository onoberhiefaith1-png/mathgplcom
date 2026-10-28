import { useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { ChevronDown, ChevronUp, FileText, Flag, GripVertical, Plus, Trash2, Video as VideoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BLOCK_ACCENT, type BlockKind, type CourseBlock, type CourseExerciseQuestion, type CourseSection } from "@/lib/courses/types";

const FIELD = "min-h-[40px] bg-white text-slate-900 placeholder:text-slate-400 border-slate-300";

export interface SectionsEditorProps {
  /** Enables the per-card "View exercise" test path when known. */
  courseId?: string;
  sections: CourseSection[];
  blocks: CourseBlock[];
  questions: CourseExerciseQuestion[];
  onAddSection: () => void;
  onRenameSection: (id: string, title: string) => void;
  onDeleteSection: (id: string) => void;
  onDuplicateSection: (id: string) => void;
  onAddBlock: (sectionId: string, kind: BlockKind) => void;
  onPatchBlock: (id: string, patch: Record<string, unknown>) => void;
  onMoveBlock: (id: string, dir: -1 | 1) => void;
  onDeleteBlock: (id: string) => void;
}

const ADD_BUTTONS: { kind: BlockKind; label: string }[] = [
  { kind: "video", label: "Video" },
  { kind: "exercise", label: "Exercise Card" },
  { kind: "text", label: "Text" },
  { kind: "conclusion", label: "Conclusion" },
];

const SectionsEditor = (p: SectionsEditorProps) => {
  const [openId, setOpenId] = useState<string | null>(p.sections[0]?.id ?? null);
  const blocksBySection = useMemo(() => {
    const map = new Map<string, CourseBlock[]>();
    for (const b of p.blocks) {
      const list = map.get(b.section_id) ?? [];
      list.push(b);
      map.set(b.section_id, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    return map;
  }, [p.blocks]);

  return (
    <div className="space-y-3">
      <Button type="button" onClick={p.onAddSection} className="w-full">
        <Plus className="mr-1.5 h-4 w-4" /> Add Section
      </Button>

      {p.sections.length === 0 && (
        <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          A course is built from sections. Add your first section to begin.
        </p>
      )}

      {p.sections.map((section) => {
        const open = openId === section.id;
        const blocks = blocksBySection.get(section.id) ?? [];
        return (
          <div key={section.id} className="rounded-2xl border border-white/15 bg-white/5">
            <div className="flex items-center gap-2 p-3">
              <GripVertical className="h-4 w-4 shrink-0 text-slate-500" />
              <Input
                className={FIELD}
                value={section.title}
                onChange={(e) => p.onRenameSection(section.id, e.target.value)}
              />
              <button
                type="button"
                onClick={() => setOpenId(open ? null : section.id)}
                className="rounded-md p-2 text-slate-300 hover:bg-white/10"
                aria-label={open ? "Collapse section" : "Expand section"}
              >
                {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => p.onDuplicateSection(section.id)}
                className="rounded-md px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
              >
                Duplicate
              </button>
              <button
                type="button"
                onClick={() => p.onDeleteSection(section.id)}
                className="rounded-md p-2 text-rose-300 hover:bg-rose-500/10"
                aria-label="Delete section"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {open && (
              <div className="space-y-3 border-t border-white/10 p-3">
                <div className="flex flex-wrap gap-2">
                  {ADD_BUTTONS.map((b) => (
                    <Button
                      key={b.kind}
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => p.onAddBlock(section.id, b.kind)}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" /> {b.label}
                    </Button>
                  ))}
                </div>

                {blocks.map((block, idx) => {
                  const qs = p.questions.filter((q) => q.block_id === block.id);
                  return (
                    <div key={block.id} className={`space-y-2 rounded-xl border p-3 ${BLOCK_ACCENT[block.kind]}`}>
                      <div className="flex items-center gap-2">
                        {block.kind === "video" && <VideoIcon className="h-4 w-4" />}
                        {block.kind === "exercise" && <span aria-hidden>📝</span>}
                        {block.kind === "text" && <FileText className="h-4 w-4" />}
                        {block.kind === "conclusion" && <Flag className="h-4 w-4" />}
                        <span className="text-xs font-semibold uppercase tracking-wide">{block.kind}</span>
                        <div className="ml-auto flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => p.onMoveBlock(block.id, -1)}
                            className="rounded p-1 disabled:opacity-30 hover:bg-black/20"
                            aria-label="Move up"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === blocks.length - 1}
                            onClick={() => p.onMoveBlock(block.id, 1)}
                            className="rounded p-1 disabled:opacity-30 hover:bg-black/20"
                            aria-label="Move down"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => p.onDeleteBlock(block.id)}
                            className="rounded p-1 hover:bg-black/20"
                            aria-label="Delete block"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {block.kind === "video" && (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input
                            className={FIELD}
                            placeholder="Video title"
                            value={block.config.title ?? ""}
                            onChange={(e) => p.onPatchBlock(block.id, { title: e.target.value })}
                          />
                          <Input
                            className={FIELD}
                            type="number"
                            placeholder="Duration (mins)"
                            value={block.config.durationMins ?? ""}
                            onChange={(e) => p.onPatchBlock(block.id, { durationMins: Number(e.target.value) || 0 })}
                          />
                          <Input
                            className={`${FIELD} sm:col-span-2`}
                            placeholder="Paste a YouTube / Vimeo / video link"
                            value={block.config.url ?? ""}
                            onChange={(e) => p.onPatchBlock(block.id, { source: "link", url: e.target.value })}
                          />
                          <label className="sm:col-span-2 text-xs">
                            <span className="mr-2">or upload a file</span>
                            <input
                              type="file"
                              accept="video/*"
                              className="text-xs"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) p.onPatchBlock(block.id, { __uploadVideo: file });
                              }}
                            />
                          </label>
                        </div>
                      )}

                      {block.kind === "exercise" && (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1 sm:col-span-2">
                            <Label className="text-xs">Exercise name (unique)</Label>
                            <Input
                              className={FIELD}
                              value={block.config.name ?? ""}
                              onChange={(e) => p.onPatchBlock(block.id, { name: e.target.value })}
                            />
                          </div>
                          <Input
                            className={FIELD}
                            placeholder="Topic"
                            value={block.config.topic ?? ""}
                            onChange={(e) => p.onPatchBlock(block.id, { topic: e.target.value })}
                          />
                          <Input
                            className={FIELD}
                            placeholder="Subtopic"
                            value={block.config.subtopic ?? ""}
                            onChange={(e) => p.onPatchBlock(block.id, { subtopic: e.target.value })}
                          />
                          <div className="space-y-1">
                            <Label className="text-xs">Total marks (from linked questions)</Label>
                            <div className="flex min-h-[40px] items-center rounded-md border border-slate-300 bg-slate-100 px-3 text-sm text-slate-700">
                              {qs.reduce((s, q) => s + (Number(q.total_marks) || 0), 0)}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Pass mark %</Label>
                            <Input
                              className={FIELD}
                              type="number"
                              placeholder="Pass mark %"
                              value={block.config.passMark ?? 80}
                              onChange={(e) => p.onPatchBlock(block.id, { passMark: Number(e.target.value) || 0 })}
                            />
                          </div>

                          <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-black/20 p-2 text-xs">
                            <span>
                              {qs.length} question{qs.length === 1 ? "" : "s"} ·{" "}
                              {qs.reduce((s, q) => s + (Number(q.total_marks) || 0), 0)} marks
                            </span>
                            {p.courseId ? (
                              qs.length === 0 ? (
                                <span className="text-white/50">Link a question to test this card</span>
                              ) : (
                                <Button asChild size="sm" variant="outline" className="h-8">
                                  <Link to={`/course-builder/${p.courseId}/exercise/${block.id}`}>
                                    View exercise
                                  </Link>
                                </Button>
                              )
                            ) : null}
                          </div>
                          <div className="sm:col-span-2 rounded-lg bg-black/20 p-2 text-xs">
                            {qs.length === 0 ? (
                              <span>
                                No questions linked yet — assign a lesson-note question to this card from Lesson Notes ▸ Assign ▸ Course Builder.
                              </span>
                            ) : (
                              <ul className="space-y-1">
                                {qs.map((q, i) => (
                                  <li key={q.id}>
                                    Question {i + 1} — {q.label || "Lesson note question"}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      )}

                      {(block.kind === "text" || block.kind === "conclusion") && (
                        <div className="grid gap-2">
                          <Input
                            className={FIELD}
                            placeholder="Heading"
                            value={block.config.heading ?? ""}
                            onChange={(e) => p.onPatchBlock(block.id, { heading: e.target.value })}
                          />
                          <textarea
                            className={`${FIELD} w-full rounded-md border px-3 py-2 text-sm`}
                            rows={3}
                            placeholder="Text students read"
                            value={block.config.body ?? ""}
                            onChange={(e) => p.onPatchBlock(block.id, { body: e.target.value })}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SectionsEditor;
