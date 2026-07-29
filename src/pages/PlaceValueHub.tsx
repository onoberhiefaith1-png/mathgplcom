import { useState } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowLeft, HelpCircle, Sparkles, Zap, Flame, Star } from "lucide-react";
import SeamlessBackground from "@/components/SeamlessBackground";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const difficulties = [
  {
    slug: "easy",
    name: "Easy",
    desc: "Tens & Units",
    stars: 1,
    Icon: Sparkles,
    glow: "from-emerald-500/30 to-emerald-700/10 border-emerald-500/60 hover:shadow-[0_0_30px_hsl(150_70%_50%/0.55)]",
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  },
  {
    slug: "medium",
    name: "Medium",
    desc: "Adds Hundreds",
    stars: 2,
    Icon: Zap,
    glow: "from-amber-500/30 to-amber-700/10 border-amber-500/60 hover:shadow-[0_0_30px_hsl(40_90%_55%/0.55)]",
    badge: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  },
  {
    slug: "hard",
    name: "Hard",
    desc: "Thousands & 10,000s",
    stars: 3,
    Icon: Flame,
    glow: "from-rose-500/30 via-fuchsia-600/20 to-purple-700/10 border-rose-500/60 hover:shadow-[0_0_30px_hsl(330_80%_55%/0.55)]",
    badge: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  },
];

const PlaceValueHub = () => {
  const [howto, setHowto] = useState(false);

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground animate-fade-in">
      <SeamlessBackground file="arcane.png" repeat={6} />
      <div className="absolute inset-0 -z-10 bg-background/70" />
      <header className="relative z-10 flex items-start justify-between p-5 sm:p-8">
        <div>
          <p className="text-xs uppercase tracking-[0.45em] text-primary sm:text-sm">Numbers and Numerals · Place Value</p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-5xl">Choose Difficulty</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setHowto(true)}>
            <HelpCircle className="h-4 w-4 mr-1" /> How to Play
          </Button>
          <Link to="/subjects/algebra/numbers-and-numerals" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-3xl gap-4 px-6 pb-10 pt-2 sm:grid-cols-3">
        {difficulties.map(({ slug, name, desc, stars, Icon, glow, badge }) => (
          <Link
            key={slug}
            to={`/games/place-value/${slug}`}
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
              {Array.from({ length: 3 }).map((_, i) => (
                <Star key={i} className={cn("h-4 w-4", i < stars ? "fill-current" : "text-muted-foreground/30")} />
              ))}
            </div>
          </Link>
        ))}
      </section>

      <Dialog open={howto} onOpenChange={setHowto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>How to Play</DialogTitle>
            <DialogDescription>Place Value Challenge</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>You'll be shown a few numbers that all contain the same target digit. Find the <b>place value</b> of that digit in each number.</p>
            <p>Drag digits 0–9 from the bottom bank into the answer slots, or tap a digit to fill the active row. Slots auto-check when filled.</p>
            <p>Each slot hides a reward. Only slots used by the correct answer award their reward — extra slots fade away.</p>
            <p>If the timer runs out, you lose a life and a fresh round appears. Lose all 5 lives → Game Over.</p>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default PlaceValueHub;
