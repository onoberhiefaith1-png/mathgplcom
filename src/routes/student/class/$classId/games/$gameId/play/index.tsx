import { createFileRoute } from "@tanstack/react-router";
import GamePlayPage from "@/pages/student/GamePlayPage";

export const Route = createFileRoute("/student/class/$classId/games/$gameId/play/")({
  component: GamePlayPage,
});
