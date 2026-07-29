import { createFileRoute } from "@tanstack/react-router";
import SmartCardGameSetupPage from "@/pages/live/SmartCardGameSetupPage";

export const Route = createFileRoute("/live/smart-cards/$cardId/game-setup/")({
  component: SmartCardGameSetupPage,
});
