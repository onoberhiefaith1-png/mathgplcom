import { createFileRoute } from "@tanstack/react-router";
import StudentReportPage from "@/pages/student/StudentReportPage";

export const Route = createFileRoute("/student/class/$classId/report/")({
  component: StudentReportPage,
});
