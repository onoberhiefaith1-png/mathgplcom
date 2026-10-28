import { createFileRoute } from "@tanstack/react-router";
import SessionPickerPage from "@/pages/live/SessionPickerPage";

export const Route = createFileRoute("/live/gallery/")({
  head: () => ({
    meta: [
      { title: "Session Gallery — MathGPL Live" },
      { name: "description", content: "Open the reward gallery for one of your live mathematics sessions." },
      { property: "og:title", content: "Session Gallery — MathGPL Live" },
      { property: "og:description", content: "Open the reward gallery for one of your live mathematics sessions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <SessionPickerPage
      title="Gallery"
      subtitle="Choose a session to open its gallery."
      target="gallery"
    />
  ),
});
