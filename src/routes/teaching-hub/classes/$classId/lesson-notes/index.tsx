import { createFileRoute } from "@tanstack/react-router";
import ClassLessonNotesPage from "@/pages/class/ClassLessonNotesPage";

export const Route = createFileRoute("/teaching-hub/classes/$classId/lesson-notes/")({
  component: ClassLessonNotesPage,
});
