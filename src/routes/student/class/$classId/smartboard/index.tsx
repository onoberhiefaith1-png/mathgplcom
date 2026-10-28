import { createFileRoute } from "@tanstack/react-router";
import StudentSmartBoardPage from "@/pages/student/StudentSmartBoardPage";
import StudentFeatureGate from "@/components/gateway/StudentFeatureGate";

export const Route = createFileRoute("/student/class/$classId/smartboard/")({
  component: () => <StudentFeatureGate item="smartboard" Page={StudentSmartBoardPage} />,
});
