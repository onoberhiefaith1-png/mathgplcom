import { createFileRoute } from "@tanstack/react-router";
import FlowLibraryPage from "@/pages/FlowLibraryPage";

export const Route = createFileRoute("/flows/")({
  head: () => ({
    meta: [
      { title: "Flow Library — MathGPL" },
      { name: "description", content: "Your Flow characters and the MathGPL Flow library for lesson notes and the Smartboard." },
      { property: "og:title", content: "Flow Library — MathGPL" },
      { property: "og:description", content: "Your Flow characters and the MathGPL Flow library." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FlowLibraryPage,
});
