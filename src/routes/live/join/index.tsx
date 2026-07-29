import { createFileRoute } from "@tanstack/react-router";
import JoinSessionPage from "@/pages/live/JoinSessionPage";

export const Route = createFileRoute("/live/join/")({
  component: JoinSessionPage,
});
