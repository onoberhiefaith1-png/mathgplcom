import { createFileRoute } from "@tanstack/react-router";
import AbacusComingSoon from "@/pages/AbacusComingSoon";

export const Route = createFileRoute("/games/abacus/$mode/")({
  component: AbacusComingSoon,
});
