import { createFileRoute } from "@tanstack/react-router";
import GuestGamePage from "@/pages/guest/GuestGamePage";

export const Route = createFileRoute("/gm/$slug/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Guest Game — Mathemagine" },
      { name: "description", content: "Play a shared Mathemagine game as a guest and get marked instantly." },
      { property: "og:title", content: "Guest Game — Mathemagine" },
      { property: "og:description", content: "Play a shared Mathemagine game as a guest and get marked instantly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuestGamePage,
});
