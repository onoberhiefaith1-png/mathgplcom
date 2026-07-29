import { createFileRoute } from "@tanstack/react-router";
import ClassAssignmentsPage from "@/pages/class/ClassAssignmentsPage";

export const Route = createFileRoute("/live/workspace/$classId/assignments/")({
  component: ClassAssignmentsPage,
});
