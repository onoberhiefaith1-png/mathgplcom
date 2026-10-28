import { createFileRoute } from "@tanstack/react-router";
import AbacusRepresent from "@/pages/AbacusRepresent";

export const Route = createFileRoute("/games/abacus/represent/$difficulty/")({
  component: AbacusRepresent,
});
