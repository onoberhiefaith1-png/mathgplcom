import { createFileRoute } from "@tanstack/react-router";
import ImagineEditorPage from "@/pages/imagine/ImagineEditorPage";

export const Route = createFileRoute("/game/slate/$gameId/")({
  head: () => ({
    meta: [
      { title: "Edit Game | Mathemagine" },
      { name: "description", content: "Design a light mathematics game with a background, writing surface, Floating Numbers and rewards." },
      { property: "og:title", content: "Edit Game | Mathemagine" },
      { property: "og:description", content: "Design a light mathematics game with a background, writing surface, Floating Numbers and rewards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ImagineEditorPage,
});
