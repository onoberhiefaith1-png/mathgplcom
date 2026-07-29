import { createFileRoute } from "@tanstack/react-router";
import ClassLessonNotesPage from "@/pages/class/ClassLessonNotesPage";

export const Route = createFileRoute("/live/workspace/$classId/lesson-notes/")({
  component: ClassLessonNotesPage,
});
