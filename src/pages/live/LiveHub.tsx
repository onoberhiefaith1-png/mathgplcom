import { Radio, BookOpen, Presentation, Image as ImageIcon, BarChart3 } from "lucide-react";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import type { WorkspaceTile } from "@/components/workspace/WorkspaceCard";

const tiles: WorkspaceTile[] = [
  {
    to: "/live/sessions",
    label: "Sessions",
    description: "Create, schedule, join and manage your live sessions.",
    icon: Radio,
    accent: "from-rose-400/30 to-rose-600/10 border-rose-300/40 text-rose-200",
  },
  {
    to: "/live/lesson-notes",
    label: "Lesson Notes",
    description: "Write the notes you will teach online.",
    icon: BookOpen,
    accent: "from-amber-400/30 to-amber-600/10 border-amber-300/40 text-amber-200",
  },
  {
    to: "/smartboard",
    label: "SmartBoard",
    description: "Teach live on the mathematical board.",
    icon: Presentation,
    accent: "from-violet-400/30 to-violet-600/10 border-violet-300/40 text-violet-200",
  },
  {
    to: "/live/gallery",
    label: "Gallery",
    description: "Rewards and artwork earned in your sessions.",
    icon: ImageIcon,
    accent: "from-fuchsia-400/30 to-fuchsia-600/10 border-fuchsia-300/40 text-fuchsia-200",
  },
  {
    to: "/live/reports",
    label: "Reports",
    description: "Progress and performance across your sessions.",
    icon: BarChart3,
    accent: "from-sky-400/30 to-sky-600/10 border-sky-300/40 text-sky-200",
  },
];

const LiveHub = () => <WorkspaceShell active="live" tiles={tiles} />;

export default LiveHub;
