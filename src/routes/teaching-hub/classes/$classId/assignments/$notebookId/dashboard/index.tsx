import { createFileRoute } from "@tanstack/react-router";
import AssignmentDashboardPage from "@/pages/class/AssignmentDashboardPage";

export const Route = createFileRoute("/teaching-hub/classes/$classId/assignments/$notebookId/dashboard/")({
  component: AssignmentDashboardPage,
});
