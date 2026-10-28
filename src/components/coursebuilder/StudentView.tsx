import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, FileText, Flag, Loader2, Lock, Play } from "lucide-react";
import { useCourseMedia, useCourseMediaUrl } from "@/lib/courses/useCourseMediaUrl";
import { videoEmbedUrl } from "@/lib/courses/media";
import type { CourseTree } from "@/lib/courses/types";

/** Plays the ORIGINAL uploaded video by reference. A shared course carries the
 *  same path as the teacher's, so nothing is ever duplicated per viewer. */
const VideoBlockView = ({ url, title, mins }: { url?: string; title?: string; mins?: number }) => {
  const { url: resolved, state } = useCourseMedia(url ?? null);
  const src = resolved ? videoEmbedUrl(resolved) : null;
  return (
    <div className="overflow-hidden rounded-xl bg-slate-900">
      <div className="aspect-video w-full">
        {src && /youtube\.com\/embed|player\.vimeo\.com/.test(src) ? (
          <iframe src={src} title={title || "Course video"} className="h-full w-full" allowFullScreen />
        ) : src ? (
          <video src={src} controls className="h-full w-full" />
        ) : state === "loading" ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading video…
          </div>
        ) : state === "unavailable" ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-6 text-center text-sm text-slate-400">
            <AlertTriangle className="h-4 w-4" />
            This video is no longer available.
          </div>
        ) : (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-400">
            <Play className="h-4 w-4" /> Video not set yet
          </div>
        )}
      </div>
      <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-300">
        <span>{title || "Untitled video"}</span>
        {mins ? <span>{mins} min</span> : null}
      </div>
    </div>
  );
};

/** Exactly what a student sees. The teacher edits on the left and watches
 *  this update live on the right. */
const StudentView = ({
  tree,
  onOpenExercise,
}: {
  tree: CourseTree;
  /** Live student flow only: opens the Exercise Card's question list. */
  onOpenExercise?: (blockId: string) => void;
}) => {
  const { course, sections, blocks, questions } = tree;
  const cover = useCourseMediaUrl(course.background_url);
  const locked = course.learning_mode === "locked";

  const ordered = useMemo(
    () =>
      sections.map((s) => ({
        section: s,
        items: blocks.filter((b) => b.section_id === s.id).sort((a, b) => a.position - b.position),
      })),
    [sections, blocks],
  );

  let exerciseIndex = 0;

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
      <div className="relative h-40 w-full bg-gradient-to-br from-slate-800 to-slate-600">
        {cover && course.background_kind === "video" ? (
          <video src={cover} className="h-full w-full object-cover" muted loop autoPlay playsInline />
        ) : cover ? (
          <img src={cover} alt={`${course.title} cover`} className="h-full w-full object-cover" />
        ) : null}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/85 to-slate-900/25" />
        <div className="absolute bottom-4 left-5 right-5 text-white">
          <h2 className="text-xl font-semibold">{course.title || "Untitled course"}</h2>
          <p className="text-xs text-white/80">
            {[course.subject, course.topic, course.subtopic].filter(Boolean).join(" • ")}
          </p>
        </div>
      </div>

      <div className="space-y-5 p-5">
        {course.description && <p className="text-sm text-slate-700">{course.description}</p>}

        <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
          <span className="rounded-full bg-slate-100 px-2.5 py-1">
            {locked ? "Step-by-step unlocking" : "Open navigation"}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1">Pass mark {course.pass_mark}%</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1">
            {course.completion_mode === "deadline"
              ? `Finish within ${course.deadline_days} days`
              : `${course.learning_days}-day pace`}
          </span>
        </div>

        {ordered.length === 0 && (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            This course has no sections yet.
          </p>
        )}

        {ordered.map(({ section, items }, sIdx) => (
          <section key={section.id} className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-900 text-[11px] text-white">
                {sIdx + 1}
              </span>
              {section.title}
            </h3>

            {items.map((block) => {
              if (block.kind === "video") {
                return (
                  <VideoBlockView
                    key={block.id}
                    url={block.config.storagePath || block.config.url}
                    title={block.config.title}
                    mins={block.config.durationMins}
                  />
                );
              }
              if (block.kind === "exercise") {
                const qs = questions.filter((q) => q.block_id === block.id);
                const isLocked = locked && exerciseIndex > 0;
                exerciseIndex += 1;
                return (
                  <div
                    key={block.id}
                    className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
                  >
                    <span className="mt-0.5 text-amber-600" aria-hidden>
                      {isLocked ? <Lock className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900">
                        {block.config.name || "Exercise"}
                      </div>
                      <p className="text-xs text-slate-600">
                        {qs.length} question{qs.length === 1 ? "" : "s"} • {block.config.totalMarks ?? 0} marks •
                        pass {block.config.passMark ?? course.pass_mark}%
                      </p>
                      {isLocked && (
                        <p className="mt-1 text-[11px] text-amber-700">
                          Unlocks once the previous exercise reaches its pass mark.
                        </p>
                      )}
                      {onOpenExercise && !isLocked && qs.length > 0 && (
                        <button
                          type="button"
                          onClick={() => onOpenExercise(block.id)}
                          className="mt-2 inline-flex min-h-[40px] items-center rounded-lg bg-amber-600 px-3 text-xs font-semibold text-white transition hover:bg-amber-700"
                        >
                          View Questions
                        </button>
                      )}
                    </div>
                  </div>
                );
              }
              const Icon = block.kind === "conclusion" ? Flag : FileText;
              return (
                <div
                  key={block.id}
                  className={`rounded-xl border p-4 ${
                    block.kind === "conclusion"
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Icon className="h-4 w-4" />
                    {block.config.heading || (block.kind === "conclusion" ? "Conclusion" : "Notes")}
                  </div>
                  {block.config.body && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{block.config.body}</p>
                  )}
                </div>
              );
            })}
          </section>
        ))}

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
          Certificate: {course.certificate_mode === "automatic" ? "issued automatically" : "issued after teacher approval"} once the
          course requirements are met.
        </div>
      </div>
    </div>
  );
};

export default StudentView;
