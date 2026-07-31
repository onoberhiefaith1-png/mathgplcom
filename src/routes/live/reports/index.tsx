import { createFileRoute } from "@tanstack/react-router";
import SessionPickerPage from "@/pages/live/SessionPickerPage";

export const Route = createFileRoute("/live/reports/")({
  head: () => ({
    meta: [
      { title: "Session Reports — MathGPL Live" },
      { name: "description", content: "Open progress and performance reports for one of your live sessions." },
      { property: "og:title", content: "Session Reports — MathGPL Live" },
      { property: "og:description", content: "Open progress and performance reports for one of your live sessions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <SessionPickerPage
      title="Reports"
      subtitle="Choose a session to open its report."
      target="report"
    />
  ),
});
