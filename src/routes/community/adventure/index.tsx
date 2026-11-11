import { createFileRoute } from "@tanstack/react-router";
import CommunitySectionPage from "@/pages/community/CommunitySectionPage";
import { TEACHING_SECTIONS } from "@/lib/community/mode";

const DESCRIPTION =
  "Adventures and maths games shared with Mathemagine Community. Preview one and copy it into your own Adventure workspace.";

export const Route = createFileRoute("/community/adventure/")({
  head: () => ({
    meta: [
      { title: "Community Adventures — Mathemagine Community" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Community Adventures — Mathemagine Community" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <CommunitySectionPage
      tabs={[{ kind: "adventure", label: "Adventures" }]}
      title="Community Adventures"
      subtitle="Copy an adventure and it becomes yours — every scene, question and reward included."
      workspacePath="/adventure"
      backTo="/community/network"
      backLabel="Community Teaching Hub"
      siblings={TEACHING_SECTIONS}
    />
  ),
});
