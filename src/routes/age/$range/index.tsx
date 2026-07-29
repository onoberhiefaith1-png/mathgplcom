import { createFileRoute } from "@tanstack/react-router";
import LevelContent from "@/pages/LevelContent";

export const Route = createFileRoute("/age/$range/")({
  component: () => <LevelContent mode="age" />,
});
