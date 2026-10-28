import { createFileRoute } from "@tanstack/react-router";
import ImaginePlayPage from "@/pages/imagine/ImaginePlayPage";

export const Route = createFileRoute("/game/play/$gameId/")({
  head: () => ({
    meta: [
      { title: "Play Game | MathGPL" },
      { name: "description", content: "Solve each question on the Floating Numbers board while rewards fly above." },
      { property: "og:title", content: "Play Game | MathGPL" },
      { property: "og:description", content: "Solve each question on the Floating Numbers board while rewards fly above." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ImaginePlayPage,
});
