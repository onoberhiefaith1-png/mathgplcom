import { createFileRoute } from "@tanstack/react-router";
import RequestsPage from "@/pages/connections/RequestsPage";

export const Route = createFileRoute("/requests/")({
  head: () => ({
    meta: [
      { title: "Requests · Mathemagine Connections" },
      {
        name: "description",
        content:
          "Accept, send and track Mathemagine connection requests between schools, teachers, students and parents.",
      },
      { property: "og:title", content: "Requests · Mathemagine Connections" },
      {
        property: "og:description",
        content: "Every Mathemagine relationship is requested by one side and accepted by the other.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RequestsPage,
});
