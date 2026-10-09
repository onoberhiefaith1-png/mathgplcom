import { createFileRoute, redirect } from "@tanstack/react-router";

// The 3D Game is archived as Game Pro; Games live at /game.
export const Route = createFileRoute("/adventure/games/")({
  beforeLoad: () => { throw redirect({ to: "/game", replace: true }); },
});
