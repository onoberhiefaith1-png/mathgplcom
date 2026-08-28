import { useEffect, useState } from "react";
import { Link } from "@/lib/router-compat";
import { BookOpen, Copy, Pencil, School } from "lucide-react";
import { useCourseMediaUrl } from "@/lib/courses/useCourseMediaUrl";
import ShareMenu from "@/components/community/ShareMenu";
import { findMyPublication } from "@/lib/community/community";
import AssignToClassDialog from "./AssignToClassDialog";
import type { CourseSummary } from "@/lib/courses/api";

interface Props {
  course: CourseSummary;
  onDuplicate: (id: string) => void;
  onDelete: (course: CourseSummary) => void;
}

const chip = "inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700";

/** One Course Card: cover on top, identity in the middle, information chips
 *  and the action bar at the bottom. */
const CourseCard = ({ course, onDuplicate, onDelete }: Props) => {
  const cover = useCourseMediaUrl(course.background_url);
  const published = course.status === "published";
  const [assigning, setAssigning] = useState(false);
  const [shared, setShared] = useState(false);

  // A course already listed in Community carries a Shared badge on the card.
  useEffect(() => {
    let alive = true;
    void findMyPublication("course", course.id)
      .then((row) => {
        if (alive) setShared(!!row && row.status === "published");
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [course.id]);

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200/70">
      <div className="relative h-36 w-full bg-gradient-to-br from-slate-200 to-slate-300">
        {cover && course.background_kind === "video" ? (
          <video src={cover} className="h-full w-full object-cover" muted playsInline />
        ) : cover ? (
          <img src={cover} alt={`${course.title} cover`} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-500">
            <BookOpen className="h-8 w-8" />
          </div>
        )}
        <div className="absolute right-3 top-3 flex items-center gap-2">
          {shared && (
            <span className="rounded-full bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white">Shared</span>
          )}
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              published ? "bg-emerald-600 text-white" : "bg-slate-900/80 text-white"
            }`}
          >
            {published ? "Published" : "Draft"}
          </span>
        </div>
      </div>

      <div className="space-y-3 p-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{course.title}</h2>
          <p className="text-xs text-slate-500">
            {[course.subject, course.topic, course.subtopic].filter(Boolean).join(" • ") || "No subject yet"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className={chip}>Sections {course.sectionCount}</span>
          <span className={chip}>Exercises {course.exerciseCount}</span>
          <span className={chip}>Students {course.studentCount}</span>
          <span className={chip}>Pass {course.pass_mark}%</span>
        </div>

        <div className="flex items-center gap-1 border-t border-slate-200 pt-3">
          <Link
            to={`/course-builder/${course.id}`}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-sm text-slate-700 transition hover:bg-slate-100"
          >
            <Pencil className="h-4 w-4" /> Edit
          </Link>
          <button
            type="button"
            onClick={() => setAssigning(true)}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-sm text-slate-700 transition hover:bg-slate-100"
          >
            <School className="h-4 w-4" /> Assign to class
          </button>
          <button
            type="button"
            onClick={() => onDuplicate(course.id)}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-sm text-slate-700 transition hover:bg-slate-100"
          >
            <Copy className="h-4 w-4" /> Duplicate
          </button>

          <ShareMenu
            className="ml-auto"
            kind="course"
            sourceId={course.id}
            title={course.title}
            description={course.description ?? undefined}
            hashtags={[course.subject, course.topic, course.subtopic]
              .filter(Boolean)
              .map((t) => `#${String(t).replace(/\s+/g, "")}`)
              .join(" ")}
            payload={{
              course_id: course.id,
              subject: course.subject,
              topic: course.topic,
              subtopic: course.subtopic,
              cover_path: course.background_url,
              media_type: course.background_kind,
            }}
            onDelete={() => onDelete(course)}
            onShareChange={setShared}
            triggerClassName="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
          />
        </div>
      </div>
      <AssignToClassDialog open={assigning} onOpenChange={setAssigning} courseId={course.id} />
    </article>

  );
};

export default CourseCard;
