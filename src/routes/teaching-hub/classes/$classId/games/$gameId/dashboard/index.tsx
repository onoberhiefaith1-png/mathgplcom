import { createFileRoute } from "@tanstack/react-router";
import AdventureDashboardPage from "@/pages/class/AdventureDashboardPage";

export const Route = createFileRoute("/teaching-hub/classes/$classId/games/$gameId/dashboard/")({
  component: AdventureDashboardPage,
});
