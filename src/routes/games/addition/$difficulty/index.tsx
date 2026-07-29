import { createFileRoute } from "@tanstack/react-router";
import AdditionGame from "@/pages/AdditionGame";

export const Route = createFileRoute("/games/addition/$difficulty/")({
  component: AdditionGame,
});
