import { createFileRoute } from "@tanstack/react-router";
import StudentClassPage from "@/pages/student/StudentClassPage";

export const Route = createFileRoute("/student/class/$classId/")({
  component: StudentClassPage,
});
