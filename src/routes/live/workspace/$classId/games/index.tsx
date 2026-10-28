import { createFileRoute } from "@tanstack/react-router";
import ClassGamesPage from "@/pages/class/ClassGamesPage";

export const Route = createFileRoute("/live/workspace/$classId/games/")({
  component: ClassGamesPage,
});
