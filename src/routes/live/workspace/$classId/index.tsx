import { createFileRoute } from "@tanstack/react-router";
import ClassDashboardPage from "@/pages/ClassDashboardPage";

export const Route = createFileRoute("/live/workspace/$classId/")({
  component: ClassDashboardPage,
});
