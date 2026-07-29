import { createFileRoute } from "@tanstack/react-router";
import SmartCardChallengePage from "@/pages/public/SmartCardChallengePage";

export const Route = createFileRoute("/card/$slug/solve/")({
  component: SmartCardChallengePage,
});
