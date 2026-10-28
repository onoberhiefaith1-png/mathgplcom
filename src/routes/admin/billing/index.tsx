import { createFileRoute, redirect } from "@tanstack/react-router";

/** Merged into the three-section economics area. */
export const Route = createFileRoute("/admin/billing/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/credits" });
  },
});
