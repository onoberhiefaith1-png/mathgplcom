import { createFileRoute } from "@tanstack/react-router";
import PlaceValueHub from "@/pages/PlaceValueHub";

export const Route = createFileRoute("/games/place-value/")({
  component: PlaceValueHub,
});
