import { createFileRoute } from "@tanstack/react-router";
import GameSlateGalleryPage from "@/pages/game/GameSlateGalleryPage";

export const Route = createFileRoute("/game/")({
  head: () => ({
    meta: [
      { title: "MathGPL Game Slate | Make Mathematics Playable" },
      {
        name: "description",
        content:
          "Create games where students write mathematics on physical surfaces, solve challenges, and earn rewards.",
      },
      { property: "og:title", content: "MathGPL Game Slate" },
      {
        property: "og:description",
        content: "Make mathematics playable with physical 3D writing surfaces and rewards.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GameSlateGalleryPage,
});
