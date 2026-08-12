import { createFileRoute, redirect } from "@tanstack/react-router";

/** Merged into the three-section economics area. */
export const Route = createFileRoute("/admin/cost-revenue/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/usage-revenue" });
  },
});
