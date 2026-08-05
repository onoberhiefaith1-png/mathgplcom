import DashboardShell from "@/components/accounts/DashboardShell";
import SectionCard from "@/components/ui/SectionCard";
import type { SectionThemeKey } from "@/lib/theme/sectionThemes";
import { Baby, BookOpen, BarChart3, Image as ImageIcon, GraduationCap, Settings } from "lucide-react";

const cards = [
  { to: "/family?tab=children", label: "Children", icon: Baby, theme: "skillBuilder", blurb: "The child accounts you created." },
  { to: "/teaching-hub", label: "Teaching Hub", icon: BookOpen, theme: "lessonNotes", blurb: "Home learning resources." },
  { to: "/family?tab=progress", label: "Progress", icon: BarChart3, theme: "reports", blurb: "How each child is doing." },
  { to: "/family?tab=reports", label: "Reports", icon: BarChart3, theme: "reports", blurb: "Assignment and adventure results." },
  { to: "/family?tab=gallery", label: "Gallery", icon: ImageIcon, theme: "gallery", blurb: "Work your children are proud of." },
  { to: "/family/teachers", label: "Teachers", icon: GraduationCap, theme: "students", blurb: "Teachers linked to your children." },
  { to: "/family?tab=settings", label: "Settings", icon: Settings, theme: "settings", blurb: "Family account preferences." },
];

const FamilyDashboard = () => (
  <DashboardShell
    title="Family"
    subtitle="Follow your children's learning. Parents only ever see their own children — never another family's students."
  >
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map(({ to, label, icon: Icon, blurb, theme }) => (
        <SectionCard
          key={label}
          theme={theme as SectionThemeKey}
          to={to}
          icon={Icon}
          label={label}
          description={blurb}
        />
      ))}
    </div>
  </DashboardShell>
);

export default FamilyDashboard;
