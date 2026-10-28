import { createFileRoute } from "@tanstack/react-router";
import LevelContent from "@/pages/LevelContent";

export const Route = createFileRoute("/year/$n/")({
  component: () => <LevelContent mode="year" />,
});
