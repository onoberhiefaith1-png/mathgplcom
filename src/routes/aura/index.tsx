import { createFileRoute } from "@tanstack/react-router";
import RequireRole from "@/components/auth/RequireRole";
import AuraWorkspacePage from "@/pages/AuraWorkspacePage";

// Archived feature: kept in the codebase, reachable only by the platform
// administration account from the console.
export const Route = createFileRoute("/aura/")({
  head: () => ({
    meta: [
      { title: "Aura (archived) — Mathemagine" },
      {
        name: "description",
        content: "Archived assistant, available to the Mathemagine platform administration account only.",
      },
      { property: "og:title", content: "Aura (archived) — Mathemagine" },
      {
        property: "og:description",
        content: "Archived assistant, available to the Mathemagine platform administration account only.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequireRole roles={["platform_owner", "co_admin"]}>
      <AuraWorkspacePage />
    </RequireRole>
  ),
});
