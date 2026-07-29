import { createFileRoute } from "@tanstack/react-router";
import ClassAdventuresPage from "@/pages/class/ClassAdventuresPage";

export const Route = createFileRoute("/live/workspace/$classId/adventures/")({
  component: ClassAdventuresPage,
});
