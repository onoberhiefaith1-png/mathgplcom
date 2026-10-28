import { createFileRoute } from "@tanstack/react-router";
import LevelContent from "@/pages/LevelContent";

export const Route = createFileRoute("/class/$code/")({
  component: () => <LevelContent mode="class" />,
});
