import { createFileRoute } from "@tanstack/react-router";
import SubtractionGame from "@/pages/SubtractionGame";

export const Route = createFileRoute("/games/subtraction/$difficulty/")({
  component: SubtractionGame,
});
