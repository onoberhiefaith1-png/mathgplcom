import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/imagine/play/$gameId/")({
  beforeLoad: ({ params, location }) => {
    throw redirect({ to: "/game/play/$gameId", params: { gameId: params.gameId }, search: location.search as never, replace: true });
  },
});
