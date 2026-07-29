import { createFileRoute } from "@tanstack/react-router";
import CommonFactorsGame from "@/pages/CommonFactorsGame";

export const Route = createFileRoute("/games/common-factors/$difficulty/")({
  component: CommonFactorsGame,
});
