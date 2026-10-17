import { createFileRoute, redirect } from "@tanstack/react-router";

// My Adventures lives at /adventure.
export const Route = createFileRoute("/adventure/games/")({
  beforeLoad: () => { throw redirect({ to: "/adventure", replace: true }); },
});
