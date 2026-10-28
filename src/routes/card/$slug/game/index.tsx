import { createFileRoute } from "@tanstack/react-router";
import SmartCardGamePage from "@/pages/public/SmartCardGamePage";

export const Route = createFileRoute("/card/$slug/game/")({
  component: SmartCardGamePage,
});
