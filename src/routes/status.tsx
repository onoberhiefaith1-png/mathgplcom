import { createFileRoute } from "@tanstack/react-router";
import StatusPage from "@/pages/StatusPage";

const TITLE = "MathGPL status — live service availability";
const DESCRIPTION =
  "Check whether MathGPL is working: lesson notes, sign in, media storage and the MathGPL Math Engine are tested live on this page.";

export const Route = createFileRoute("/status")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StatusPage,
});
