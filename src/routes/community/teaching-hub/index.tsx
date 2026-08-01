import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Compass, Users } from "lucide-react";
import CommunityHubPage from "@/pages/community/CommunityHubPage";
import type { WorkspaceTile } from "@/components/workspace/WorkspaceCard";

const DESCRIPTION =
  "The community Teaching Hub: shared lesson notes, shared classes and shared adventures from other educators. Copy anything into your own workspace or request access to a class.";

const tiles: WorkspaceTile[] = [
  {
    to: "/community/lesson-notes",
    label: "Lesson Notes",
    description: "Shared notes and lesson-note assets. Copy one and it becomes yours.",
    icon: BookOpen,
    accent: "from-amber-400/30 to-amber-600/10 border-amber-300/40 text-amber-200",
  },
  {
    to: "/community/classes",
    label: "Classes",
    description: "Shared classes. Request access and the teacher decides.",
    icon: Users,
    accent: "from-cyan-400/30 to-cyan-600/10 border-cyan-300/40 text-cyan-200",
  },
  {
    to: "/community/adventure",
    label: "Adventure",
    description: "Shared games and adventures. Copy one into your Adventure workspace.",
    icon: Compass,
    accent: "from-orange-400/30 to-orange-600/10 border-orange-300/40 text-orange-100",
  },
];

export const Route = createFileRoute("/community/teaching-hub/")({
  head: () => ({
    meta: [
      { title: "Community Teaching Hub — MathGPL Community" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Community Teaching Hub — MathGPL Community" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <CommunityHubPage
      title="Community Teaching Hub"
      subtitle="Read-only teaching resources shared by other educators."
      tiles={tiles}
      workspacePath="/teaching-hub"
    />
  ),
});
