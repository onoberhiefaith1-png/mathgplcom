import { createFileRoute } from "@tanstack/react-router";
import FloatingNumbersPage from "@/pages/FloatingNumbersPage";

export const Route = createFileRoute("/lesson-notes/$notebookId/floating/$subsectionId/")({
  component: FloatingNumbersPage,
});
