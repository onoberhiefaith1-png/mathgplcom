import { createFileRoute } from "@tanstack/react-router";
import AuraWorkspacePage from "@/pages/AuraWorkspacePage";

export const Route = createFileRoute("/aura/")({
  head: () => ({
    meta: [
      { title: "Aura — talk to MathGPL" },
      {
        name: "description",
        content:
          "Tell Aura what you need — lesson notes, questions, classes, games — and she builds it inside MathGPL while you watch.",
      },
      { property: "og:title", content: "Aura — talk to MathGPL" },
      {
        property: "og:description",
        content:
          "Tell Aura what you need — lesson notes, questions, classes, games — and she builds it inside MathGPL while you watch.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuraWorkspacePage,
});
