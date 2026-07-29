import { createFileRoute } from "@tanstack/react-router";
import StudentAdventuresPage from "@/pages/student/StudentAdventuresPage";

export const Route = createFileRoute("/student/class/$classId/adventures/")({
  component: StudentAdventuresPage,
});
