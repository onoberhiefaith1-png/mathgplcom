import { createFileRoute } from "@tanstack/react-router";
import AssistantTrainingPage from "@/pages/admin/AssistantTrainingPage";

export const Route = createFileRoute("/admin/assistant-training/")({
  head: () => ({
    meta: [
      { title: "Assistant Training — MathGPL Admin" },
      { name: "description", content: "Train and approve the guidance MathGPL's connected assistants follow." },
      { property: "og:title", content: "Assistant Training — MathGPL Admin" },
      { property: "og:description", content: "Train and approve the guidance MathGPL's connected assistants follow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AssistantTrainingPage,
});
