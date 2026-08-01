import { createFileRoute } from "@tanstack/react-router";
import CommunitySectionPage from "@/pages/community/CommunitySectionPage";

const DESCRIPTION =
  "Classes shared with MathGPL Community. Send an access request and the teacher decides whether to accept or reject it.";

export const Route = createFileRoute("/community/classes/")({
  head: () => ({
    meta: [
      { title: "Community Classes — MathGPL Community" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Community Classes — MathGPL Community" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <CommunitySectionPage
      kind="class"
      title="Community Classes"
      subtitle="Classes are never copied. Request access, and you join once the teacher accepts."
      workspacePath="/teaching-hub/classes"
    />
  ),
});
