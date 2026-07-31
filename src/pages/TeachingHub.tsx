import { BookOpen, Sparkles, Users, Compass } from "lucide-react";
import adventureClouds from "@/assets/adventure-clouds.png.asset.json";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import type { WorkspaceTile } from "@/components/workspace/WorkspaceCard";

const tiles: WorkspaceTile[] = [
  {
    to: "/lesson-notes",
    label: "Lesson Notes",
    description: "Write, structure and generate your teaching notes.",
    icon: BookOpen,
    accent: "from-amber-400/30 to-amber-600/10 border-amber-300/40 text-amber-200",
  },
  {
    to: "/smartboard",
    label: "SmartBoard",
    description: "Teach live on the mathematical board.",
    icon: Sparkles,
    accent: "from-violet-400/30 to-violet-600/10 border-violet-300/40 text-violet-200",
  },
  {
    to: "/teaching-hub/classes",
    label: "Classes",
    description: "Your classes, students and class work.",
    icon: Users,
    accent: "from-cyan-400/30 to-cyan-600/10 border-cyan-300/40 text-cyan-200",
  },
  {
    to: "/adventure",
    label: "Adventure",
    description: "Game-based practice across the maths islands.",
    icon: Compass,
    accent: "from-orange-400/30 to-orange-600/10 border-orange-300/40 text-orange-100",
    image: adventureClouds.url,
    imageAlt: "Sunset clouds over mountains with sacred geometry",
  },
];

const TeachingHub = () => <WorkspaceShell active="teaching-hub" tiles={tiles} />;

export default TeachingHub;
