import { createFileRoute } from "@tanstack/react-router";
import FlowLibraryPage from "@/pages/FlowLibraryPage";

export const Route = createFileRoute("/flows/")({
  head: () => ({
    meta: [
      { title: "Flow Library — Mathemagine" },
      { name: "description", content: "Your Flow characters and the Mathemagine Flow library for lesson notes and the Smartboard." },
      { property: "og:title", content: "Flow Library — Mathemagine" },
      { property: "og:description", content: "Your Flow characters and the Mathemagine Flow library." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FlowLibraryPage,
});
