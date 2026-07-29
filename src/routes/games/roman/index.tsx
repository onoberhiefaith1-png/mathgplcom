import { createFileRoute } from "@tanstack/react-router";
import RomanGame from "@/pages/RomanGame";

export const Route = createFileRoute("/games/roman/")({
  component: RomanGame,
});
