import RoleShell from "@/components/accounts/RoleShell";
import { Link } from "@/lib/router-compat";
import { Baby, BookOpen, BarChart3, Image as ImageIcon, GraduationCap, Settings } from "lucide-react";

const cards = [
  { to: "/family?tab=children", label: "Children", icon: Baby, blurb: "The child accounts you created." },
  { to: "/teaching-hub", label: "Teaching Hub", icon: BookOpen, blurb: "Home learning resources." },
  { to: "/family?tab=progress", label: "Progress", icon: BarChart3, blurb: "How each child is doing." },
  { to: "/family?tab=reports", label: "Reports", icon: BarChart3, blurb: "Assignment and adventure results." },
  { to: "/family?tab=gallery", label: "Gallery", icon: ImageIcon, blurb: "Work your children are proud of." },
  { to: "/family?tab=teachers", label: "Teachers", icon: GraduationCap, blurb: "Teachers linked to your children." },
  { to: "/family?tab=settings", label: "Settings", icon: Settings, blurb: "Family account preferences." },
];

const FamilyDashboard = () => (
  <RoleShell title="Family">
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
      You will create each child's account from the Children page in the next phase. Parents only
      ever see their own children — never another family's students.
    </p>
  </RoleShell>
);

export default FamilyDashboard;
