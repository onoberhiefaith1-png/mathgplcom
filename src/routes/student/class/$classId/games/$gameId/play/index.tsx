import { createFileRoute } from "@tanstack/react-router";
import GamePlayPage from "@/pages/student/GamePlayPage";
import StudentFeatureGate from "@/components/gateway/StudentFeatureGate";

export const Route = createFileRoute("/student/class/$classId/games/$gameId/play/")({
  component: () => <StudentFeatureGate item="adventure" Page={GamePlayPage} />,
});
