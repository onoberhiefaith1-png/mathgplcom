import { createFileRoute } from "@tanstack/react-router";
import ParticipantSessionPage from "@/pages/live/ParticipantSessionPage";

export const Route = createFileRoute("/live/s/$sessionId/")({
  component: ParticipantSessionPage,
});
