import { createFileRoute } from "@tanstack/react-router";
import GameSlateEditorPage from "@/pages/game/GameSlateEditorPage";

export const Route = createFileRoute("/admin/game-pro/slate/$gameId/")({
  head: () => ({ meta: [{ title: "Game Pro Editor (Archived) | MathGPL Admin" }, { name: "robots", content: "noindex" }] }),
  component: GameSlateEditorPage,
});
