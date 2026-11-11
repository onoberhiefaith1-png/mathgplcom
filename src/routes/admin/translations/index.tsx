import { createFileRoute } from "@tanstack/react-router";
import TranslationCoverage from "@/pages/admin/TranslationCoverage";

export const Route = createFileRoute("/admin/translations/")({
  head: () => ({
    meta: [
      { title: "Update translations — Mathemagine" },
      {
        name: "description",
        content: "Translation coverage for every Mathemagine interface language, measured against the English master catalogue.",
      },
      { property: "og:title", content: "Update translations — Mathemagine" },
      {
        property: "og:description",
        content: "Translation coverage for every Mathemagine interface language, measured against the English master catalogue.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TranslationCoverage,
});
