import { createFileRoute } from "@tanstack/react-router";
import StudentsPage from "@/pages/class/StudentsPage";

export const Route = createFileRoute("/live/workspace/$classId/students/")({
  component: StudentsPage,
});
