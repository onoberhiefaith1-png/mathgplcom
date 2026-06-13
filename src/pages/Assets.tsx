import { Link } from "react-router-dom";
import { ArrowLeft, FolderOpen, Sparkles } from "lucide-react";
import SeamlessBackground from "@/components/SeamlessBackground";
import { assetCategories } from "@/data/assets";
import QuestionProgressContainer from "@/components/assets/QuestionProgressContainer";

const Assets = () => (
  <main className="relative min-h-screen text-foreground animate-fade-in">
    <SeamlessBackground file="ivory.png" />

    <header className="relative z-10 flex items-center justify-between p-5 sm:p-8">
      <div>
        <p className="text-xs uppercase tracking-[0.45em] text-primary sm:text-sm drop-shadow">
          Game Assets
        </p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-5xl drop-shadow">
          Assets
        </h1>
      </div>
      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-full bg-background/60 px-3 py-1.5 text-sm text-foreground backdrop-blur underline-offset-4 hover:text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
    </header>

    <section className="relative z-10 mx-auto max-w-6xl px-6 pb-10">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">
        Interactive
      </h2>
      <Link
        to="/assets/interactive/question-progress"
        className="group flex items-center gap-5 rounded-xl border border-primary/40 bg-background/60 p-5 backdrop-blur transition hover:border-primary hover:bg-background/80"
      >
        <QuestionProgressContainer
          questionNumber={7}
          current={6}
          max={10}
          theme="purple"
          width={88}
        />
        <div className="flex-1">
          <div className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            Question Progress Container
          </div>
          <div className="text-xs text-muted-foreground">
            Reusable crystal vessel with live liquid fill driven by current ÷ max. Configurable themes.
          </div>
        </div>
      </Link>
    </section>

    <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">
        Library
      </h2>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-3">
        {assetCategories.map((c) => (
          <Link
            key={c.slug}
            to={`/assets/${c.slug}`}
            className="group flex flex-col items-center gap-3 rounded-xl border border-border/40 bg-background/50 p-6 backdrop-blur transition hover:border-primary/60 hover:bg-background/70"
          >
            <FolderOpen className="h-10 w-10 text-primary transition-transform group-hover:scale-110" />
            <div className="text-center">
              <div className="text-base font-semibold">{c.name}</div>
              <div className="text-xs text-muted-foreground">
                {c.subcategories.length} folder{c.subcategories.length === 1 ? "" : "s"}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  </main>
);

export default Assets;
