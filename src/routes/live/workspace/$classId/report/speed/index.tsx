import { createFileRoute } from "@tanstack/react-router";
import ClassSpeedPerformancePage from "@/pages/class/ClassSpeedPerformancePage";

export const Route = createFileRoute("/live/workspace/$classId/report/speed/")({
  component: ClassSpeedPerformancePage,
});
