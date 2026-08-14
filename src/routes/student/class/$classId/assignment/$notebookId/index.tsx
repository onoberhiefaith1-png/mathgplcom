import { createFileRoute } from "@tanstack/react-router";
import StudentAssignmentPage from "@/pages/student/StudentAssignmentPage";
import StudentFeatureGate from "@/components/gateway/StudentFeatureGate";

export const Route = createFileRoute("/student/class/$classId/assignment/$notebookId/")({
  component: () => <StudentFeatureGate item="assignment" Page={StudentAssignmentPage} />,
});
