import { createFileRoute } from "@tanstack/react-router";
import StudentGamesPage from "@/pages/student/StudentGamesPage";
import StudentFeatureGate from "@/components/gateway/StudentFeatureGate";

export const Route = createFileRoute("/student/class/$classId/games/")({
  component: () => <StudentFeatureGate item="adventure" Page={StudentGamesPage} />,
});
