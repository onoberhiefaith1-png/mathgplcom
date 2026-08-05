import DashboardShell from "@/components/accounts/DashboardShell";
import SectionCard from "@/components/ui/SectionCard";
import type { SectionThemeKey } from "@/lib/theme/sectionThemes";
import { Users, GraduationCap, BookOpen, BarChart3, CreditCard, Settings, Shield } from "lucide-react";

const cards = [
  { to: "/teaching-hub", label: "Teaching Hub", icon: BookOpen, theme: "lessonNotes", blurb: "Lesson notes, SmartBoard and classes." },
  { to: "/teaching-hub/classes", label: "Classes", icon: Users, theme: "classes", blurb: "Every class in this school." },
  { to: "/school/teachers", label: "Teachers", icon: GraduationCap, theme: "students", blurb: "Add, invite, suspend or remove your teachers." },
  { to: "/school?tab=students", label: "Students", icon: Users, theme: "students", blurb: "Students owned by this school." },
  { to: "/school?tab=reports", label: "Reports & Analytics", icon: BarChart3, theme: "reports", blurb: "School-wide progress." },
  { to: "/school?tab=accounts", label: "Accounts", icon: Shield, theme: "assessment", blurb: "Invitations, permissions, suspensions." },
  { to: "/school?tab=billing", label: "Billing", icon: CreditCard, theme: "rewards", blurb: "Licences, subscription and AI quota." },
  { to: "/teaching-hub/settings", label: "Settings", icon: Settings, theme: "settings", blurb: "School preferences." },
];

const SchoolDashboard = () => (
  <DashboardShell
    title="School"
    subtitle="Your institution's workspace. This school only ever sees the teachers and students it owns."
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

export default SchoolDashboard;
