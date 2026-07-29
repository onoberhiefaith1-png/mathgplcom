import { createFileRoute } from "@tanstack/react-router";
import TeacherAssessmentViewerPage from "@/pages/class/TeacherAssessmentViewerPage";

export const Route = createFileRoute("/live/workspace/$classId/assessments/$assessmentId/student/$studentId/")({
  component: TeacherAssessmentViewerPage,
});
