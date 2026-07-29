import { createFileRoute } from "@tanstack/react-router";
import SmartCardGameDashboardPage from "@/pages/live/SmartCardGameDashboardPage";

export const Route = createFileRoute("/live/smart-cards/$cardId/game-dashboard/")({
  component: SmartCardGameDashboardPage,
});
