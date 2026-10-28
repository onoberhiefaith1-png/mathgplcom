import { createFileRoute } from "@tanstack/react-router";
import SmartCardChallengePage from "@/pages/public/SmartCardChallengePage";

export const Route = createFileRoute("/challenge/$slug/solve/")({
  component: SmartCardChallengePage,
});
