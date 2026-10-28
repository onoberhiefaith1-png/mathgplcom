import { createFileRoute } from "@tanstack/react-router";
import SmartCardGamePage from "@/pages/public/SmartCardGamePage";

export const Route = createFileRoute("/challenge/$slug/game/")({
  component: SmartCardGamePage,
});
