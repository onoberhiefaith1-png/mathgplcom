import { createFileRoute } from "@tanstack/react-router";
import DivisionGame from "@/pages/DivisionGame";

export const Route = createFileRoute("/games/division/$difficulty/")({
  component: DivisionGame,
});
