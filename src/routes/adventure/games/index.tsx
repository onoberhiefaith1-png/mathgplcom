import { createFileRoute } from "@tanstack/react-router";
import AdventureGamesDashboard from "@/pages/adventure/AdventureGamesDashboard";

export const Route = createFileRoute("/adventure/games/")({
  component: AdventureGamesDashboard,
});
