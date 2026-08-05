import { Radio, BookOpen, Presentation, Image as ImageIcon, BarChart3 } from "lucide-react";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import type { WorkspaceTile } from "@/components/workspace/WorkspaceCard";

const tiles: WorkspaceTile[] = [
  {
    to: "/live/sessions",
    label: "Sessions",
    description: "Create, schedule, join and manage your live sessions.",
    icon: Radio,
    theme: "sessions",
  },
  {
    to: "/live/lesson-notes",
    label: "Lesson Notes",
    description: "Write the notes you will teach online.",
    icon: BookOpen,
    theme: "lessonNotes",
  },
  {
    to: "/smartboard",
    label: "SmartBoard",
    description: "Teach live on the mathematical board.",
    icon: Presentation,
    theme: "smartboard",
  },
  {
    to: "/live/gallery",
    label: "Gallery",
    description: "Rewards and artwork earned in your sessions.",
    icon: ImageIcon,
    theme: "gallery",
  },
  {
    to: "/live/reports",
    label: "Reports",
    description: "Progress and performance across your sessions.",
    icon: BarChart3,
    theme: "reports",
  },
];

const LiveHub = () => <WorkspaceShell active="live" tiles={tiles} />;

export default LiveHub;
