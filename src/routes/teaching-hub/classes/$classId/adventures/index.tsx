import { createFileRoute } from "@tanstack/react-router";
import ClassAdventuresPage from "@/pages/class/ClassAdventuresPage";

export const Route = createFileRoute("/teaching-hub/classes/$classId/adventures/")({
  component: ClassAdventuresPage,
});
