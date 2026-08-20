import { createFileRoute } from "@tanstack/react-router";
import ConnectionHelpPage from "@/pages/help/ConnectionHelpPage";

const TITLE = "Fix “connection is not private” — MathGPL help";
const DESCRIPTION =
  "Why a school or family web filter can show a privacy warning for mathgpl.com, how to confirm it in 30 seconds, and what to ask your IT team to allow.";

export const Route = createFileRoute("/help/connection")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConnectionHelpPage,
});
