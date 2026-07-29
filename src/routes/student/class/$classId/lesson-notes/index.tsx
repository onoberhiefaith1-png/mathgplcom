import { createFileRoute } from "@tanstack/react-router";
import StudentLessonNotesPage from "@/pages/student/StudentLessonNotesPage";

export const Route = createFileRoute("/student/class/$classId/lesson-notes/")({
  component: StudentLessonNotesPage,
});
