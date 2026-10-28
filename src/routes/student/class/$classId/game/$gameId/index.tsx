import { createFileRoute } from "@tanstack/react-router";
import GamePlayPage from "@/pages/student/GamePlayPage";
import StudentFeatureGate from "@/components/gateway/StudentFeatureGate";

export const Route = createFileRoute("/student/class/$classId/game/$gameId/")({
  component: () => <StudentFeatureGate item="adventure" Page={GamePlayPage} />,
});
