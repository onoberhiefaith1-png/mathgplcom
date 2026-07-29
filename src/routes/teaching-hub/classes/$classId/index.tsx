import { createFileRoute } from "@tanstack/react-router";
import ClassDashboardPage from "@/pages/ClassDashboardPage";

export const Route = createFileRoute("/teaching-hub/classes/$classId/")({
  component: ClassDashboardPage,
});
