import { createFileRoute } from "@tanstack/react-router";
import LevelContent from "@/pages/LevelContent";

export const Route = createFileRoute("/levels/$id/")({
  component: () => <LevelContent mode="level" />,
});
