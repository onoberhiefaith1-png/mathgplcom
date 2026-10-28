import { createFileRoute } from "@tanstack/react-router";
import ClassSpeedPerformancePage from "@/pages/class/ClassSpeedPerformancePage";

export const Route = createFileRoute("/teaching-hub/classes/$classId/report/speed/")({
  component: ClassSpeedPerformancePage,
});
