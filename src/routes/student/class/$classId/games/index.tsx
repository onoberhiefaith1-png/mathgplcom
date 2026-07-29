import { createFileRoute } from "@tanstack/react-router";
import StudentGamesPage from "@/pages/student/StudentGamesPage";

export const Route = createFileRoute("/student/class/$classId/games/")({
  component: StudentGamesPage,
});
