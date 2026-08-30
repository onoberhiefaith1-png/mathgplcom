import { createFileRoute } from "@tanstack/react-router";
import CommunitySectionPage from "@/pages/community/CommunitySectionPage";
import { TEACHING_SECTIONS } from "@/lib/community/mode";

const DESCRIPTION =
  "Skill Builder courses shared with MathGPL Community: guided video lessons, exercises and text sections. Copy any course into your own Skill Builder and edit it freely.";

export const Route = createFileRoute("/community/courses/")({
  head: () => ({
    meta: [
      { title: "Community Courses — MathGPL Community" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Community Courses — MathGPL Community" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <CommunitySectionPage
      tabs={[
        {
          kind: "course",
          label: "Courses",
          subtitle:
            "Every course educators shared. Copy one and the whole course — sections, videos and exercises — becomes yours in Skill Builder.",
        },
      ]}
      title="Community Courses"
      subtitle="Shared Skill Builder courses, ready to copy."
      workspacePath="/course-builder"
      backTo="/community/network"
      backLabel="Community"
      siblings={TEACHING_SECTIONS}
    />
  ),
});
