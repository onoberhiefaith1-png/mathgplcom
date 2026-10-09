import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/adventure/games/$gameId/")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/game/slate/$gameId", params: { gameId: params.gameId }, replace: true });
  },
});
