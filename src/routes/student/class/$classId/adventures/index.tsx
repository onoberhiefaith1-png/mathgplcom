import { createFileRoute } from "@tanstack/react-router";
import StudentAdventuresPage from "@/pages/student/StudentAdventuresPage";
import StudentFeatureGate from "@/components/gateway/StudentFeatureGate";

export const Route = createFileRoute("/student/class/$classId/adventures/")({
  component: () => <StudentFeatureGate item="adventure" Page={StudentAdventuresPage} />,
});
