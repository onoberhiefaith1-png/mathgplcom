import { createFileRoute } from "@tanstack/react-router";
import SmartCardEditorPage from "@/pages/live/SmartCardEditorPage";

export const Route = createFileRoute("/live/smart-cards/$cardId/")({
  component: SmartCardEditorPage,
});
