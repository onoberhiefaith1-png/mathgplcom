import { createFileRoute } from "@tanstack/react-router";
import StudentSmartBoardPage from "@/pages/student/StudentSmartBoardPage";

export const Route = createFileRoute("/student/class/$classId/smartboard/")({
  component: StudentSmartBoardPage,
});
