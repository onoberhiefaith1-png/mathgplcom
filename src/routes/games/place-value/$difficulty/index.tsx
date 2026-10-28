import { createFileRoute } from "@tanstack/react-router";
import PlaceValueGame from "@/pages/PlaceValueGame";

export const Route = createFileRoute("/games/place-value/$difficulty/")({
  component: PlaceValueGame,
});
