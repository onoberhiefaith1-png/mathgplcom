import { createFileRoute } from "@tanstack/react-router";
import ClassReportPage from "@/pages/class/ClassReportPage";

export const Route = createFileRoute("/live/workspace/$classId/report/")({
  component: ClassReportPage,
});
