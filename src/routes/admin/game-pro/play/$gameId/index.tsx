import { createFileRoute } from "@tanstack/react-router";
import GamePlayPage from "@/pages/game/GamePlayPage";

export const Route = createFileRoute("/admin/game-pro/play/$gameId/")({
  head: () => ({ meta: [{ title: "Play Game Pro (Archived) | MathGPL Admin" }, { name: "robots", content: "noindex" }] }),
  component: GamePlayPage,
});
