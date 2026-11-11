import { createFileRoute } from "@tanstack/react-router";
import GuestAssignmentPage from "@/pages/guest/GuestAssignmentPage";

export const Route = createFileRoute("/a/$slug/")({
  head: () => ({
    meta: [
      { title: "Guest Assignment — Mathemagine" },
      { name: "description", content: "Solve a shared Mathemagine assignment card as a guest and get marked instantly." },
      { property: "og:title", content: "Guest Assignment — Mathemagine" },
      { property: "og:description", content: "Solve a shared Mathemagine assignment card as a guest and get marked instantly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuestAssignmentPage,
});
