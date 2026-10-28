import { createFileRoute } from "@tanstack/react-router";
import CreateSessionPage from "@/pages/live/CreateSessionPage";

export const Route = createFileRoute("/live/sessions/$sessionId/settings")({
  component: CreateSessionPage,
});
