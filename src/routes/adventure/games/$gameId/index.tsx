import { createFileRoute } from "@tanstack/react-router";
import GameEditorPage from "@/pages/GameEditorPage";

export const Route = createFileRoute("/adventure/games/$gameId/")({
  component: GameEditorPage,
});
