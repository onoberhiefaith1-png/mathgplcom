import { Link } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Radio,
  Presentation,
  ClipboardList,
  Compass,
  ClipboardCheck,
  Image as ImageIcon,
  BarChart3,
  Settings as SettingsIcon,
} from "lucide-react";

const tiles = [
  { to: "/live/sessions", label: "Sessions", icon: Radio, accent: "from-rose-400/30 to-rose-600/10 border-rose-300/40 text-rose-200" },
  { to: "/lesson-notes", label: "Lesson Notes", icon: BookOpen, accent: "from-amber-400/30 to-amber-600/10 border-amber-300/40 text-amber-200" },
  { to: "/smartboard", label: "SmartBoard", icon: Presentation, accent: "from-violet-400/30 to-violet-600/10 border-violet-300/40 text-violet-200" },
  { to: "/live/sessions", label: "Assignments", icon: ClipboardList, accent: "from-cyan-400/30 to-cyan-600/10 border-cyan-300/40 text-cyan-200" },
  { to: "/live/sessions", label: "Adventure", icon: Compass, accent: "from-orange-400/30 to-orange-600/10 border-orange-300/40 text-orange-200" },
  { to: "/live/sessions", label: "Assessment", icon: ClipboardCheck, accent: "from-emerald-400/30 to-emerald-600/10 border-emerald-300/40 text-emerald-200" },
  { to: "/live/sessions", label: "Gallery", icon: ImageIcon, accent: "from-fuchsia-400/30 to-fuchsia-600/10 border-fuchsia-300/40 text-fuchsia-200" },
  { to: "/live/sessions", label: "Reports", icon: BarChart3, accent: "from-sky-400/30 to-sky-600/10 border-sky-300/40 text-sky-200" },
  { to: "/teaching-hub/settings", label: "Settings", icon: SettingsIcon, accent: "from-slate-400/30 to-slate-600/10 border-slate-300/40 text-slate-200" },
];

const LiveHub = () => (
  <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
    <header className="flex items-center justify-between px-6 py-5">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>
      <h1 className="text-lg font-semibold tracking-wide">MathGPL Live</h1>
      <Link to="/teaching-hub" className="text-sm text-muted-foreground hover:text-foreground">
        Teaching Hub
      </Link>
    </header>

    <main className="mx-auto max-w-5xl px-6 py-8">
      <section className="mb-8 rounded-2xl border border-rose-300/30 bg-gradient-to-br from-rose-500/15 to-transparent p-6 backdrop-blur">
        <div className="inline-flex items-center gap-2 rounded-full border border-rose-300/40 bg-rose-400/10 px-3 py-1 text-xs font-medium text-rose-200">
          <span className="h-2 w-2 animate-pulse rounded-full bg-rose-400" /> Teach mathematics online
        </div>
        <h2 className="mt-3 text-3xl font-semibold">Sessions replace classrooms</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Create a lesson note, schedule a session, share the session code and go live. The whole teaching
          engine — Smartboard, Assignments, Adventure, Assessment, Gallery and Reports — works exactly as it does in
          the classroom.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            to="/live/sessions/create"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Create Session
          </Link>
          <Link
            to="/live/join"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium transition hover:bg-accent"
          >
            Join with a code
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {tiles.map(({ to, label, icon: Icon, accent }) => (
          <Link
            key={label}
            to={to}
            className={`group flex h-32 flex-col justify-between rounded-2xl border bg-gradient-to-br ${accent} p-4 backdrop-blur transition hover:scale-[1.02] hover:shadow-2xl`}
          >
            <Icon className="h-6 w-6" />
            <div className="text-lg font-semibold">{label}</div>
          </Link>
        ))}
      </div>
    </main>
  </div>
);

export default LiveHub;
