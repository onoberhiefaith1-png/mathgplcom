import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles, Zap, Flame, Star, Crown } from "lucide-react";
import SeamlessBackground from "@/components/SeamlessBackground";
import { cn } from "@/lib/utils";

const difficulties = [
  {
    slug: "easy", name: "Easy", desc: "2-digit × 1-digit", stars: 1, Icon: Sparkles,
    glow: "from-emerald-500/30 to-emerald-700/10 border-emerald-500/60 hover:shadow-[0_0_30px_hsl(150_70%_50%/0.55)]",
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  },
  {
    slug: "medium", name: "Medium", desc: "2-digit × 2-digit", stars: 2, Icon: Zap,
    glow: "from-amber-500/30 to-amber-700/10 border-amber-500/60 hover:shadow-[0_0_30px_hsl(40_90%_55%/0.55)]",
    badge: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  },
  {
    slug: "hard", name: "Hard", desc: "3-digit × 2-digit", stars: 3, Icon: Flame,
    glow: "from-rose-500/30 via-fuchsia-600/20 to-purple-700/10 border-rose-500/60 hover:shadow-[0_0_30px_hsl(330_80%_55%/0.55)]",
    badge: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  },
  {
    slug: "expert", name: "Expert", desc: "3-digit × 3-digit", stars: 4, Icon: Crown,
    glow: "from-violet-500/30 via-indigo-600/20 to-sky-700/10 border-violet-500/60 hover:shadow-[0_0_30px_hsl(270_80%_60%/0.55)]",
    badge: "bg-violet-500/20 text-violet-300 border-violet-500/40",
  },
];

const MultiplicationHub = () => (
  <main className="relative min-h-screen overflow-hidden bg-background text-foreground animate-fade-in">
    <SeamlessBackground file="royal-gold.png" repeat={6} />
    <div className="absolute inset-0 -z-10 bg-background/70" />
    <header className="relative z-10 flex items-start justify-between p-5 sm:p-8">
      <div>
        <p className="text-xs uppercase tracking-[0.45em] text-amber-400 sm:text-sm">Numbers and Numerals · Multiplication</p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-5xl">Long Multiplication Builder</h1>
        <p className="mt-1 text-sm text-muted-foreground">Build the answer step-by-step, just like on paper.</p>
      </div>
      <Link to="/subjects/algebra/numbers-and-numerals" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
    </header>

    <section className="relative z-10 mx-auto grid max-w-4xl gap-4 px-6 pb-10 pt-2 sm:grid-cols-2 lg:grid-cols-4">
      {difficulties.map(({ slug, name, desc, stars, Icon, glow, badge }) => (
        <Link
          key={slug}
          to={`/games/multiplication/${slug}`}
          className={cn(
            "group relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl border-2 bg-gradient-to-b p-5 text-center backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:scale-[1.03]",
            glow,
          )}
        >
          <div className={cn("flex h-14 w-14 items-center justify-center rounded-full border-2 transition-transform group-hover:scale-110", badge)}>
            <Icon className="h-7 w-7" />
          </div>
          <div className="text-xl font-black uppercase tracking-wider text-foreground">{name}</div>
          <p className="text-xs text-muted-foreground">{desc}</p>
          <div className="flex gap-0.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Star key={i} className={cn("h-4 w-4", i < stars ? "fill-current" : "text-muted-foreground/30")} />
            ))}
          </div>
        </Link>
      ))}
    </section>
  </main>
);

export default MultiplicationHub;
