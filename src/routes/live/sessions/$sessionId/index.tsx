import { createFileRoute } from "@tanstack/react-router";
import SessionDashboardPage from "@/pages/live/SessionDashboardPage";

export const Route = createFileRoute("/live/sessions/$sessionId/")({
  component: SessionDashboardPage,
});
