import { createFileRoute } from "@tanstack/react-router";
import LevelContent from "@/pages/LevelContent";

export const Route = createFileRoute("/grade/$n/")({
  component: () => <LevelContent mode="grade" />,
});
