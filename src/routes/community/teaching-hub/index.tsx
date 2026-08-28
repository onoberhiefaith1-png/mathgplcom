import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Compass, GraduationCap, Users } from "lucide-react";
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
    theme: "lessonNotes",
  },
  {
    to: "/community/classes",
    label: "Classes",
    description: "Shared classes. Request access and the teacher decides.",
    icon: Users,
    theme: "classes",
  },
  {
    to: "/community/adventure",
    label: "Adventure",
    description: "Shared games and adventures. Copy one into your Adventure workspace.",
    icon: Compass,
    theme: "adventure",
  },
  {
    to: "/community/courses",
    label: "Courses",
    description: "Shared Skill Builder courses. Copy one into your own Skill Builder.",
    icon: GraduationCap,
    theme: "adventure",
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
