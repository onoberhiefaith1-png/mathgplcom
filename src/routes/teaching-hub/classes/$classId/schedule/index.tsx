import { createFileRoute } from "@tanstack/react-router";
import ClassSchedulePage from "@/pages/ClassSchedulePage";

const DESCRIPTION =
  "Set when and where your class meets, and plan what you will teach on each date so students always know what is coming next.";

export const Route = createFileRoute("/teaching-hub/classes/$classId/schedule/")({
  head: () => ({
    meta: [
      { title: "Class Schedule — Mathemagine" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Class Schedule — Mathemagine" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClassSchedulePage,
});
