import { createFileRoute } from "@tanstack/react-router";
import ImagineHomePage from "@/pages/imagine/ImagineHomePage";

export const Route = createFileRoute("/game/")({
  head: () => ({
    meta: [
      { title: "MathGPL Game | Fast 2D Mathematics Games" },
      { name: "description", content: "Create and play light mathematics games with Smartboard writing, backgrounds and rewards." },
      { property: "og:title", content: "MathGPL Game | Fast 2D Mathematics Games" },
      { property: "og:description", content: "Create and play light mathematics games with Smartboard writing, backgrounds and rewards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ImagineHomePage,
});
