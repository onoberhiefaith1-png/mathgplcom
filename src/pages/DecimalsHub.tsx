// Decimals subtopic landing page — lists the 7 decimal game modules.
import { Link } from "@/lib/router-compat";
import { ArrowLeft, Calculator, Divide, Minus, Plus, Repeat, Shuffle, X } from "lucide-react";
import SeamlessBackground from "@/components/SeamlessBackground";
import { cn } from "@/lib/utils";

const modules = [
  { slug: "frac-to-dec", name: "Fraction → Decimal", desc: "Long-divide to convert", Icon: Repeat,
    glow: "from-cyan-500/30 to-cyan-700/10 border-cyan-500/60 hover:shadow-[0_0_30px_hsl(190_80%_55%/0.55)]",
    badge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" },
  { slug: "dec-to-frac", name: "Decimal → Fraction", desc: "Convert and simplify", Icon: Calculator,
    glow: "from-violet-500/30 to-violet-700/10 border-violet-500/60 hover:shadow-[0_0_30px_hsl(265_80%_60%/0.55)]",
    badge: "bg-violet-500/20 text-violet-300 border-violet-500/40" },
  { slug: "add", name: "Decimal Addition", desc: "Add with place-value alignment", Icon: Plus,
    glow: "from-emerald-500/30 to-emerald-700/10 border-emerald-500/60 hover:shadow-[0_0_30px_hsl(150_70%_50%/0.55)]",
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
  { slug: "sub", name: "Decimal Subtraction", desc: "Borrow across the point", Icon: Minus,
    glow: "from-rose-500/30 to-rose-700/10 border-rose-500/60 hover:shadow-[0_0_30px_hsl(350_75%_55%/0.55)]",
    badge: "bg-rose-500/20 text-rose-300 border-rose-500/40" },
  { slug: "mul", name: "Decimal Multiplication", desc: "Convert to fractions, multiply", Icon: X,
    glow: "from-amber-500/30 to-amber-700/10 border-amber-500/60 hover:shadow-[0_0_30px_hsl(40_90%_55%/0.55)]",
    badge: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
  { slug: "div", name: "Decimal Division", desc: "Reciprocal & simplify", Icon: Divide,
    glow: "from-sky-500/30 to-sky-700/10 border-sky-500/60 hover:shadow-[0_0_30px_hsl(210_85%_60%/0.55)]",
    badge: "bg-sky-500/20 text-sky-300 border-sky-500/40" },
  { slug: "mixed", name: "Mixed Operations", desc: "+ − × ÷ in one expression", Icon: Shuffle,
    glow: "from-fuchsia-500/30 via-purple-600/20 to-purple-700/10 border-fuchsia-500/60 hover:shadow-[0_0_30px_hsl(300_75%_60%/0.55)]",
    badge: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40" },
];

export const DecimalsHub = () => (
  <main className="relative min-h-screen overflow-hidden bg-background text-foreground animate-fade-in">
    <SeamlessBackground file="royal-gold.png" repeat={6} />
    <div className="absolute inset-0 -z-10 bg-background/70" />
    <header className="relative z-10 flex items-start justify-between p-5 sm:p-8">
      <div>
        <p className="text-xs uppercase tracking-[0.45em] text-amber-400 sm:text-sm">Algebra · Decimals</p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-5xl">Decimal Challenges</h1>
        <p className="mt-1 text-sm text-muted-foreground">Seven decimal games on the universal MathBoard engine.</p>
      </div>
      <Link to="/subjects/algebra" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
    </header>
    <section className="relative z-10 mx-auto grid max-w-5xl gap-4 px-6 pb-10 pt-2 sm:grid-cols-2 lg:grid-cols-3">
      {modules.map(({ slug, name, desc, Icon, glow, badge }) => (
        <Link key={slug} to={`/games/decimals/${slug}`}
          className={cn("group relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl border-2 bg-gradient-to-b p-5 text-center backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:scale-[1.03]", glow)}>
          <div className={cn("flex h-14 w-14 items-center justify-center rounded-full border-2 transition-transform group-hover:scale-110", badge)}>
            <Icon className="h-7 w-7" />
          </div>
          <div className="text-lg font-black uppercase tracking-wider text-foreground">{name}</div>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </Link>
      ))}
    </section>
  </main>
);

export default DecimalsHub;
