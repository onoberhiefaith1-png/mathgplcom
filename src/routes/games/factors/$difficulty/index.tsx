import { createFileRoute } from "@tanstack/react-router";
import FactorGame from "@/pages/FactorGame";

export const Route = createFileRoute("/games/factors/$difficulty/")({
  component: FactorGame,
});
