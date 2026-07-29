import { createFileRoute } from "@tanstack/react-router";
import FloatingPreparationPage from "@/pages/FloatingPreparationPage";

export const Route = createFileRoute("/lesson-notes/$notebookId/floating-prep/$subsectionId/")({
  component: FloatingPreparationPage,
});
