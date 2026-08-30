import { createFileRoute } from "@tanstack/react-router";
import CommunitySectionPage from "@/pages/community/CommunitySectionPage";
import { TEACHING_SECTIONS } from "@/lib/community/mode";

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
      tabs={[{ kind: "class", label: "Classes" }]}
      title="Community Classes"
      subtitle="Classes are never copied. Request access, and you join once the teacher accepts."
      workspacePath="/teaching-hub/classes"
      backTo="/community/network"
      backLabel="Community Teaching Hub"
      siblings={TEACHING_SECTIONS}
    />
  ),
});
