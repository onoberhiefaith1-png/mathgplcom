import { createFileRoute, redirect } from "@tanstack/react-router";

// Imagine is now the MathGPL Game.
export const Route = createFileRoute("/imagine/")({
  beforeLoad: () => { throw redirect({ to: "/game", replace: true }); },
});
