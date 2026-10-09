import { createFileRoute } from "@tanstack/react-router";
import ImagineEditorPage from "@/pages/imagine/ImagineEditorPage";

export const Route = createFileRoute("/game/slate/$gameId/")({
  head: () => ({
    meta: [
      { title: "Edit Game | MathGPL" },
      { name: "description", content: "Design a light mathematics game with a background, writing surface, Floating Numbers and rewards." },
      { property: "og:title", content: "Edit Game | MathGPL" },
      { property: "og:description", content: "Design a light mathematics game with a background, writing surface, Floating Numbers and rewards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ImagineEditorPage,
});
