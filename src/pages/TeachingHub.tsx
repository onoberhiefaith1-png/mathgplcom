import { BookOpen, Sparkles, Users, Compass, GraduationCap } from "lucide-react";
import adventureClouds from "@/assets/adventure-clouds.png.asset.json";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import WorkspaceInvitations from "@/components/accounts/WorkspaceInvitations";
import WorkspaceVisibilityCard from "@/components/accounts/WorkspaceVisibilityCard";
import type { WorkspaceTile } from "@/components/workspace/WorkspaceCard";

const tiles: WorkspaceTile[] = [
  {
    to: "/lesson-notes",
    label: "Lesson Notes",
    description: "Write, structure and generate your teaching notes.",
    icon: BookOpen,
    theme: "lessonNotes",
  },
  {
    to: "/smartboard",
    label: "SmartBoard",
    description: "Teach live on the mathematical board.",
    icon: Sparkles,
    theme: "smartboard",
  },
  {
    to: "/teaching-hub/classes",
    label: "Classes",
    description: "Your classes, students and class work.",
    icon: Users,
    theme: "classes",
  },
  {
    to: "/adventure",
    label: "Adventure",
    description: "Game-based practice across the maths islands.",
    icon: Compass,
    theme: "adventure",
    image: adventureClouds.url,
    imageAlt: "Sunset clouds over mountains with sacred geometry",
  },
  {
    to: "/course-builder",
    label: "Skill Builder",
    description: "Build courses: videos, exercise cards and certificates.",
    icon: GraduationCap,
    theme: "skillBuilder",
  },
];

const TeachingHub = () => (
  <WorkspaceShell active="teaching-hub" tiles={tiles}>
    <div className="mt-8 space-y-4">
      <WorkspaceInvitations />
      <WorkspaceVisibilityCard />
    </div>
  </WorkspaceShell>
);

export default TeachingHub;
