import { createFileRoute } from "@tanstack/react-router";
import AiSettingsPage from "@/pages/floating/AiSettingsPage";

export const Route = createFileRoute("/lesson-notes/$notebookId/floating/$subsectionId/ai-settings/")({
  component: AiSettingsPage,
});
