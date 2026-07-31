import DashboardShell from "@/components/accounts/DashboardShell";
import { Link } from "@/lib/router-compat";
import { Baby, BookOpen, BarChart3, Image as ImageIcon, GraduationCap, Settings } from "lucide-react";

const cards = [
  { to: "/family?tab=children", label: "Children", icon: Baby, tone: "from-emerald-500 to-teal-600", blurb: "The child accounts you created." },
  { to: "/teaching-hub", label: "Teaching Hub", icon: BookOpen, tone: "from-sky-500 to-blue-600", blurb: "Home learning resources." },
  { to: "/family?tab=progress", label: "Progress", icon: BarChart3, tone: "from-violet-500 to-purple-600", blurb: "How each child is doing." },
  { to: "/family?tab=reports", label: "Reports", icon: BarChart3, tone: "from-fuchsia-500 to-pink-600", blurb: "Assignment and adventure results." },
  { to: "/family?tab=gallery", label: "Gallery", icon: ImageIcon, tone: "from-amber-400 to-orange-500", blurb: "Work your children are proud of." },
  { to: "/family/teachers", label: "Teachers", icon: GraduationCap, tone: "from-cyan-500 to-sky-600", blurb: "Teachers linked to your children." },
  { to: "/family?tab=settings", label: "Settings", icon: Settings, tone: "from-slate-500 to-slate-700", blurb: "Family account preferences." },
];

const FamilyDashboard = () => (
  <DashboardShell
    title="Family"
    subtitle="Follow your children's learning. Parents only ever see their own children — never another family's students."
  >
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map(({ to, label, icon: Icon, blurb, tone }) => (
        <Link
          key={label}
          to={to}
          className="group relative overflow-hidden rounded-2xl border border-dash-border bg-dash-surface p-5 shadow-[var(--shadow-dash)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_26px_54px_-24px_hsl(224_60%_6%/0.7)] active:translate-y-0 active:scale-[0.99]"
        >
          <span aria-hidden className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tone}`} />
          <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${tone} text-dash-surface shadow-md transition-transform duration-200 group-hover:scale-110`}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="mt-4 text-lg font-semibold text-dash-surface-foreground">{label}</div>
          <p className="mt-1 text-xs text-dash-surface-muted">{blurb}</p>
        </Link>
      ))}
    </div>
  </DashboardShell>
);

export default FamilyDashboard;
