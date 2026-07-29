import { createFileRoute } from "@tanstack/react-router";
import NotebookEditorPage from "@/pages/NotebookEditorPage";

export const Route = createFileRoute("/live/lesson-notes/$id/")({
  component: NotebookEditorPage,
});
