import { createFileRoute } from "@tanstack/react-router";
import AssessmentBoardPage from "@/pages/student/AssessmentBoardPage";

export const Route = createFileRoute("/student/class/$classId/assessment/$assessmentId/")({
  component: AssessmentBoardPage,
});
