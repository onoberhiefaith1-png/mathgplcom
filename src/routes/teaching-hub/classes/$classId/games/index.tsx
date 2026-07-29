import { createFileRoute } from "@tanstack/react-router";
import ClassGamesPage from "@/pages/class/ClassGamesPage";

export const Route = createFileRoute("/teaching-hub/classes/$classId/games/")({
  component: ClassGamesPage,
});
