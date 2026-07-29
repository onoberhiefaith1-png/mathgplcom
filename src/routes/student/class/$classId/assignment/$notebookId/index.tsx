import { createFileRoute } from "@tanstack/react-router";
import StudentAssignmentPage from "@/pages/student/StudentAssignmentPage";

export const Route = createFileRoute("/student/class/$classId/assignment/$notebookId/")({
  component: StudentAssignmentPage,
});
