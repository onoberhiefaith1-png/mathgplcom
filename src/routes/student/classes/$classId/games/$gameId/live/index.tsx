import { createFileRoute } from "@tanstack/react-router";
import StudentGameLivePage from "@/pages/student/StudentGameLivePage";

export const Route = createFileRoute("/student/classes/$classId/games/$gameId/live/")({
  component: StudentGameLivePage,
});
