import { useEffect, useState } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import { ArrowLeft, GraduationCap, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import CourseCard from "@/components/coursebuilder/CourseCard";
import { createCourse, deleteCourse, duplicateCourse, listCourses, type CourseSummary } from "@/lib/courses/api";

/** The Course Library: every course this teacher owns. */
const CourseBuilderLibrary = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const refresh = async () => {
    try {
      setCourses(await listCourses());
    } catch (e: unknown) {
      toast({ title: "Could not load courses", description: String((e as Error)?.message ?? e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const onCreate = async () => {
    setCreating(true);
    try {
      const course = await createCourse("Untitled course");
      navigate({ to: `/course-builder/${course.id}` });
    } catch (e: unknown) {
      toast({ title: "Could not create course", description: String((e as Error)?.message ?? e), variant: "destructive" });
      setCreating(false);
    }
  };

  const onDuplicate = async (id: string) => {
    try {
      await duplicateCourse(id);
      await refresh();
      toast({ title: "Course duplicated" });
    } catch (e: unknown) {
      toast({ title: "Duplicate failed", description: String((e as Error)?.message ?? e), variant: "destructive" });
    }
  };

  const onDelete = async (course: CourseSummary) => {
    if (!window.confirm(`Delete “${course.title}”? This cannot be undone.`)) return;
    try {
      await deleteCourse(course.id);
      setCourses((prev) => prev.filter((c) => c.id !== course.id));
    } catch (e: unknown) {
      toast({ title: "Delete failed", description: String((e as Error)?.message ?? e), variant: "destructive" });
    }
  };

  const visible = courses.filter((c) =>
    [c.title, c.subject, c.topic, c.subtopic].join(" ").toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-6 py-6">
        <Link
          to="/teaching-hub"
          className="inline-flex min-h-[44px] items-center gap-2 text-sm text-slate-300 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Teaching Hub
        </Link>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-white">
          <GraduationCap className="h-5 w-5 text-amber-300" /> Skill Builder
        </h1>
        <div className="ml-auto flex items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses"
            className="min-h-[44px] w-48 border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
          />
          <Button type="button" onClick={onCreate} disabled={creating} className="min-h-[44px]">
            {creating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
            New course
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-16">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your courses…
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-xl">
            <GraduationCap className="mx-auto h-8 w-8 text-slate-400" />
            <h2 className="mt-3 text-lg font-semibold text-slate-900">No courses yet</h2>
            <p className="mt-1 text-sm text-slate-600">
              A course holds your videos, exercises and text in the order students follow.
            </p>
            <Button type="button" onClick={onCreate} className="mt-4 min-h-[44px]">
              <Plus className="mr-1.5 h-4 w-4" /> Create your first course
            </Button>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((course) => (
              <CourseCard key={course.id} course={course} onDuplicate={onDuplicate} onDelete={onDelete} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default CourseBuilderLibrary;
