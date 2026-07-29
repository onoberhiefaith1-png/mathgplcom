import { createFileRoute } from "@tanstack/react-router";
import ClassReportPage from "@/pages/class/ClassReportPage";

export const Route = createFileRoute("/teaching-hub/classes/$classId/report/")({
  component: ClassReportPage,
});
