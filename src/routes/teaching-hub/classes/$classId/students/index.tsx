import { createFileRoute } from "@tanstack/react-router";
import StudentsPage from "@/pages/class/StudentsPage";

export const Route = createFileRoute("/teaching-hub/classes/$classId/students/")({
  component: StudentsPage,
});
