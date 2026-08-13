import { createFileRoute } from "@tanstack/react-router";
import WebsiteContentPage from "@/pages/admin/WebsiteContentPage";

const title = "Website content — MathGPL";
const description =
  "Edit every section of the public MathGPL homepage: media, headlines, order, visibility and testimonials.";

export const Route = createFileRoute("/admin/website/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WebsiteContentPage,
});
