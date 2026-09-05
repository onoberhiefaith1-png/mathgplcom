import { createFileRoute } from "@tanstack/react-router";
import StudentSpeedPerformancePage from "@/pages/student/StudentSpeedPerformancePage";
import StudentFeatureGate from "@/components/gateway/StudentFeatureGate";

export const Route = createFileRoute("/student/class/$classId/report/speed/")({
  component: () => <StudentFeatureGate item="reports" Page={StudentSpeedPerformancePage} />,
});
