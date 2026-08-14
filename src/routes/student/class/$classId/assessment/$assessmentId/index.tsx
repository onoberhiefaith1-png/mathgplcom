import { createFileRoute } from "@tanstack/react-router";
import AssessmentBoardPage from "@/pages/student/AssessmentBoardPage";
import StudentFeatureGate from "@/components/gateway/StudentFeatureGate";

export const Route = createFileRoute("/student/class/$classId/assessment/$assessmentId/")({
  component: () => <StudentFeatureGate item="assessment" Page={AssessmentBoardPage} />,
});
