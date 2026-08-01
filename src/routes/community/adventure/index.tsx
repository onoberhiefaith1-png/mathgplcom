import { createFileRoute } from "@tanstack/react-router";
import CommunitySectionPage from "@/pages/community/CommunitySectionPage";

const DESCRIPTION =
  "Adventure games shared with MathGPL Community. Preview, like and copy an adventure into your own game workspace.";

export const Route = createFileRoute("/community/adventure/")({
  head: () => ({
    meta: [
      { title: "Community Adventures — MathGPL Community" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Community Adventures — MathGPL Community" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <CommunitySectionPage
      kind="adventure"
      title="Community Adventures"
      subtitle="Copy an adventure and it lands in your own Adventure workspace, fully editable."
      workspacePath="/adventure"
    />
  ),
});
