import { createFileRoute } from "@tanstack/react-router";
import SessionsPage from "@/pages/live/SessionsPage";

export const Route = createFileRoute("/live/sessions/")({
  component: SessionsPage,
});
