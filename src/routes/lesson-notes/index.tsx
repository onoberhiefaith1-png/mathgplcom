import { createFileRoute } from "@tanstack/react-router";
import LessonNotesPage from "@/pages/LessonNotesPage";

export const Route = createFileRoute("/lesson-notes/")({
  component: LessonNotesPage,
});
