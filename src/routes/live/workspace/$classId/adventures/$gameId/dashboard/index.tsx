import { createFileRoute } from "@tanstack/react-router";
import AdventureDashboardPage from "@/pages/class/AdventureDashboardPage";

export const Route = createFileRoute("/live/workspace/$classId/adventures/$gameId/dashboard/")({
  component: AdventureDashboardPage,
});
