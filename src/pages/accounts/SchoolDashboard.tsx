import RoleShell from "@/components/accounts/RoleShell";
import { Link } from "@/lib/router-compat";
import { Users, GraduationCap, BookOpen, BarChart3, CreditCard, Settings, Shield } from "lucide-react";

const cards = [
  { to: "/teaching-hub", label: "Teaching Hub", icon: BookOpen, blurb: "Lesson notes, SmartBoard and classes." },
  { to: "/teaching-hub/classes", label: "Classes", icon: Users, blurb: "Every class in this school." },
  { to: "/school?tab=teachers", label: "Teachers", icon: GraduationCap, blurb: "Teachers owned by this school." },
  { to: "/school?tab=students", label: "Students", icon: Users, blurb: "Students owned by this school." },
  { to: "/school?tab=reports", label: "Reports & Analytics", icon: BarChart3, blurb: "School-wide progress." },
  { to: "/school?tab=accounts", label: "Accounts", icon: Shield, blurb: "Invitations, permissions, suspensions." },
  { to: "/school?tab=billing", label: "Billing", icon: CreditCard, blurb: "Licences, subscription and AI quota." },
  { to: "/teaching-hub/settings", label: "Settings", icon: Settings, blurb: "School preferences." },
];

const SchoolDashboard = () => (
  <RoleShell title="School">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map(({ to, label, icon: Icon, blurb }) => (
        <Link
          key={label}
          to={to}
          className="rounded-2xl border border-border bg-card/40 p-5 backdrop-blur transition hover:border-primary/40 hover:shadow-xl"
        >
          <Icon className="h-6 w-6 text-primary" />
          <div className="mt-3 text-lg font-semibold">{label}</div>
          <p className="mt-1 text-xs text-muted-foreground">{blurb}</p>
        </Link>
      ))}
    </div>
    <p className="mt-8 text-xs text-muted-foreground">
      Account management screens (add, invite, suspend, bulk import) arrive in the next phase. This
      school only ever sees the teachers and students it owns.
    </p>
  </RoleShell>
);

export default SchoolDashboard;
