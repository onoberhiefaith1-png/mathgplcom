import { createFileRoute } from "@tanstack/react-router";
import ClassGameLivePage from "@/pages/class/ClassGameLivePage";

export const Route = createFileRoute("/teaching-hub/classes/$classId/games/$gameId/live/")({
  component: ClassGameLivePage,
});
