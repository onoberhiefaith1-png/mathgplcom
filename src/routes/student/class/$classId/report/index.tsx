import { createFileRoute } from "@tanstack/react-router";
import StudentReportPage from "@/pages/student/StudentReportPage";
import StudentFeatureGate from "@/components/gateway/StudentFeatureGate";

export const Route = createFileRoute("/student/class/$classId/report/")({
  component: () => <StudentFeatureGate item="reports" Page={StudentReportPage} />,
});
