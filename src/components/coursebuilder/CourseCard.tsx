import { useState } from "react";
import { Link } from "@/lib/router-compat";
import { BookOpen, Copy, Eye, Pencil, School, Trash2 } from "lucide-react";
import { useCourseMediaUrl } from "@/lib/courses/useCourseMediaUrl";
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
        <span
          className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            published ? "bg-emerald-600 text-white" : "bg-slate-900/80 text-white"
          }`}
        >
          {published ? "Published" : "Draft"}
        </span>
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
            to={`/course-builder/${course.id}?view=student`}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-sm text-slate-700 transition hover:bg-slate-100"
          >
            <Eye className="h-4 w-4" /> View
          </Link>
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

          <button
            type="button"
            onClick={() => onDelete(course)}
            className="ml-auto inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-sm text-rose-600 transition hover:bg-rose-50"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>
    </article>
  );
};

export default CourseCard;
