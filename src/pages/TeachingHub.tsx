import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen, Sparkles, Users, Settings as SettingsIcon, LogIn } from "lucide-react";

const tiles = [
  { to: "/lesson-notes", label: "Lesson Notes", icon: BookOpen, accent: "from-amber-400/30 to-amber-600/10 border-amber-300/40 text-amber-200" },
  { to: "/smartboard", label: "SmartBoard", icon: Sparkles, accent: "from-violet-400/30 to-violet-600/10 border-violet-300/40 text-violet-200" },
  { to: "/teaching-hub/classes", label: "Classes", icon: Users, accent: "from-cyan-400/30 to-cyan-600/10 border-cyan-300/40 text-cyan-200" },
  { to: "/join", label: "Join a Class", icon: LogIn, accent: "from-emerald-400/30 to-emerald-600/10 border-emerald-300/40 text-emerald-200" },
  { to: "/teaching-hub/settings", label: "Settings", icon: SettingsIcon, accent: "from-slate-400/30 to-slate-600/10 border-slate-300/40 text-slate-200" },
];

const TeachingHub = () => (
  <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
    <header className="flex items-center justify-between px-6 py-5">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>
      <h1 className="text-lg font-semibold tracking-wide">Teaching Hub</h1>
      <div className="w-16" />
    </header>
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {tiles.map(({ to, label, icon: Icon, accent }) => (
          <Link
            key={to}
            to={to}
            className={`group relative flex h-40 flex-col justify-between overflow-hidden rounded-2xl border bg-gradient-to-br ${accent} p-6 backdrop-blur transition hover:scale-[1.02] hover:shadow-2xl`}
          >
            <Icon className="h-8 w-8" />
            <div className="text-2xl font-semibold">{label}</div>
          </Link>
        ))}
      </div>
    </main>
  </div>
);

export default TeachingHub;
