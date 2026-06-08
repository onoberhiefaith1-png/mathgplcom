import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, HelpCircle } from "lucide-react";
import SeamlessBackground from "@/components/SeamlessBackground";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const modes = [
  { slug: "represent", name: "Represent Numbers", desc: "Build numbers using place value." },
  { slug: "addition", name: "Addition", desc: "Add numbers with the abacus.", soon: true },
  { slug: "subtraction", name: "Subtraction", desc: "Subtract numbers with the abacus.", soon: true },
];

const difficulties = [
  { slug: "easy", name: "Easy", desc: "Tens & Units (1–99)" },
  { slug: "medium", name: "Medium", desc: "Hundreds, Tens, Units (100–999)" },
  { slug: "hard", name: "Hard", desc: "Thousands range (1000–9999)" },
];

const AbacusHub = () => {
  const [picked, setPicked] = useState<string | null>(null);
  const [howto, setHowto] = useState(false);

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground animate-fade-in">
      <SeamlessBackground file="obsidian.png" repeat={6} />
      <div className="absolute inset-0 -z-10 bg-background/70" />
      <header className="relative z-10 flex items-start justify-between p-5 sm:p-8">
        <div>
          <p className="text-xs uppercase tracking-[0.45em] text-primary sm:text-sm">Numbers and Numerals · Abacus</p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-5xl">Choose a Mode</h1>
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

      <section className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-4 px-6 pb-10 pt-6">
        {modes.map((m) => (
          <button
            key={m.slug}
            type="button"
            disabled={m.soon}
            onClick={() => !m.soon && setPicked(m.slug)}
            className="group w-full rounded-lg border border-primary/30 bg-background/60 px-6 py-5 text-left text-foreground backdrop-blur transition hover:border-primary hover:bg-background/80 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold uppercase tracking-wider">{m.name}</span>
              {m.soon && <span className="text-[10px] rounded bg-muted px-2 py-1 uppercase">Coming Soon</span>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{m.desc}</p>
          </button>
        ))}
      </section>

      {/* Difficulty picker */}
      <Dialog open={!!picked} onOpenChange={(o) => !o && setPicked(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose Difficulty</DialogTitle>
            <DialogDescription>Pick a level to enter the gate.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {difficulties.map((d) => (
              <Link
                key={d.slug}
                to={`/games/abacus/${picked}/${d.slug}`}
                className="rounded-lg border border-primary/30 bg-background/60 px-4 py-3 hover:border-primary hover:bg-background/80"
                onClick={() => setPicked(null)}
              >
                <div className="font-bold">{d.name}</div>
                <div className="text-xs text-muted-foreground">{d.desc}</div>
              </Link>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* How to play */}
      <Dialog open={howto} onOpenChange={setHowto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>How to Play</DialogTitle>
            <DialogDescription>Quick guide to the Abacus game.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <div className="font-bold text-primary mb-1">The Abacus</div>
              <p>Each rod is a place value column: <b>TH</b>=Thousands, <b>H</b>=Hundreds, <b>T</b>=Tens, <b>U</b>=Units.</p>
            </div>
            <div>
              <div className="font-bold text-primary mb-1">Beads</div>
              <p>Click an inactive bead to push it down (add value). Click an active bead to pull it up (remove value). The number under each rod shows that column's digit.</p>
            </div>
            <div>
              <div className="font-bold text-primary mb-1">Goal</div>
              <p>Build the target number, press <b>Open Gate</b>. Doors fly open and treasure pours out. Collect enough treasure to complete objectives and unlock the next level.</p>
            </div>
            <div>
              <div className="font-bold text-primary mb-1">Timer & Lives</div>
              <p>You have a few seconds per round. If the timer runs out you lose a life. Wrong answers are free — keep trying!</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default AbacusHub;
