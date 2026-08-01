import { createFileRoute } from "@tanstack/react-router";
import CommunitySectionPage from "@/pages/community/CommunitySectionPage";

const DESCRIPTION =
  "Live sessions shared with MathGPL Community. See who is teaching, when the session starts, and join straight from the card.";

export const Route = createFileRoute("/community/live/")({
  head: () => ({
    meta: [
      { title: "Community Live Sessions — MathGPL Community" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Community Live Sessions — MathGPL Community" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <CommunitySectionPage
      tabs={[{ kind: "session", label: "Live Sessions" }]}
      title="Community Live Sessions"
      subtitle="Open teaching sessions shared with the community. Sessions are never copied — you join them."
      workspacePath="/live"
    />
  ),
});
