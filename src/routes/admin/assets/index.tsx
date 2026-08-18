import { createFileRoute, redirect } from "@tanstack/react-router";

/** The asset library is managed on the Assets pages themselves. */
export const Route = createFileRoute("/admin/assets/")({
  beforeLoad: () => {
    throw redirect({ to: "/assets" });
  },
});
