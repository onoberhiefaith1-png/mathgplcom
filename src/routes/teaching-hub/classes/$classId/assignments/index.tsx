import { createFileRoute } from "@tanstack/react-router";
import ClassAssignmentsPage from "@/pages/class/ClassAssignmentsPage";

export const Route = createFileRoute("/teaching-hub/classes/$classId/assignments/")({
  component: ClassAssignmentsPage,
});
