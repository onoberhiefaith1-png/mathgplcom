import { useState } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowLeft } from "lucide-react";
import SeamlessBackground from "@/components/SeamlessBackground";
import QuestionProgressContainer, { CrystalTheme } from "@/components/assets/QuestionProgressContainer";

const THEMES: { value: CrystalTheme; label: string; swatch: string }[] = [
  { value: "blue",   label: "Blue Crystal",   swatch: "#3fb6ff" },
  { value: "green",  label: "Green Crystal",  swatch: "#43e36b" },
  { value: "purple", label: "Purple Crystal", swatch: "#a460ff" },
  { value: "orange", label: "Orange Crystal", swatch: "#ff8a1f" },
  { value: "gold",   label: "Gold Crystal",   swatch: "#ffc83a" },
];

const QuestionProgressContainerEditor = () => {
  const [current, setCurrent] = useState<number>(3);
  const [max, setMax] = useState<number>(10);
  const [theme, setTheme] = useState<CrystalTheme>("blue");
  const [zoom, setZoom] = useState<number>(280);

  const safeMax = Math.max(0, max);
  const safeCurrent = Math.min(Math.max(0, current), safeMax);
  const pct = safeMax > 0 ? (safeCurrent / safeMax) * 100 : 0;

  return (
    <main className="relative min-h-screen text-foreground animate-fade-in">
      <SeamlessBackground file="arcane.png" />

      <header className="relative z-10 flex items-center justify-between p-5 sm:p-8">
        <div>
          <p className="text-xs uppercase tracking-[0.45em] text-primary sm:text-sm drop-shadow">
            Interactive Asset
          </p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl drop-shadow">
            Question Progress Container
          </h1>
        </div>
        <Link
          to="/assets"
          className="inline-flex items-center gap-2 rounded-full bg-background/60 px-3 py-1.5 text-sm text-foreground backdrop-blur underline-offset-4 hover:text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </header>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-8 px-6 pb-24 lg:grid-cols-[1fr_360px]">
        {/* LIVE PREVIEW */}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border/40 bg-background/40 p-8 backdrop-blur overflow-auto">
          <QuestionProgressContainer
            
            current={safeCurrent}
            max={safeMax}
            theme={theme}
            width={zoom}
          />
          <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span>Liquid level: <span className="font-semibold text-foreground">{pct.toFixed(1)}%</span></span>
            <span>•</span>
            <span>Size: <span className="font-semibold text-foreground">{zoom}px</span></span>
          </div>
        </div>

        {/* CONFIG PANEL */}
        <aside className="rounded-2xl border border-border/40 bg-background/60 p-5 backdrop-blur">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-primary">
            Configuration
          </h2>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Current Value
              </span>
              <input
                type="number"
                value={current}
                min={0}
                onChange={(e) => setCurrent(Number(e.target.value) || 0)}
                className="w-full rounded-md border border-border/60 bg-background/80 px-3 py-2 text-sm focus:border-primary focus:outline-hidden"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Maximum Value
              </span>
              <input
                type="number"
                value={max}
                min={1}
                onChange={(e) => setMax(Number(e.target.value) || 1)}
                className="w-full rounded-md border border-border/60 bg-background/80 px-3 py-2 text-sm focus:border-primary focus:outline-hidden"
              />
            </label>

            <label className="block">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Zoom (size)</span>
                <span className="text-xs font-mono text-foreground">{zoom}px</span>
              </div>
              <input
                type="range"
                min={16}
                max={1200}
                step={2}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <button type="button" onClick={() => setZoom(24)} className="hover:text-primary">tiny</button>
                <button type="button" onClick={() => setZoom(80)} className="hover:text-primary">small</button>
                <button type="button" onClick={() => setZoom(280)} className="hover:text-primary">medium</button>
                <button type="button" onClick={() => setZoom(600)} className="hover:text-primary">large</button>
                <button type="button" onClick={() => setZoom(1200)} className="hover:text-primary">huge</button>
              </div>
            </label>


            <div>
              <span className="mb-2 block text-xs font-medium text-muted-foreground">
                Crystal Theme
              </span>
              <div className="grid grid-cols-5 gap-2">
                {THEMES.map((th) => (
                  <button
                    key={th.value}
                    type="button"
                    onClick={() => setTheme(th.value)}
                    aria-label={th.label}
                    title={th.label}
                    className={`h-10 rounded-md border-2 transition ${
                      theme === th.value ? "border-primary scale-105" : "border-border/40"
                    }`}
                    style={{ background: th.swatch }}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-md bg-background/60 p-3 text-xs text-muted-foreground">
              Tip: the liquid scales continuously to <span className="font-mono">current ÷ max</span>.
              Any maximum is supported (10, 100, 2000, 1,000,000…).
            </div>
          </div>
        </aside>
      </section>

      {/* SAMPLE WALL — shows the asset reused at scale */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-primary">
          Examples
        </h2>
        <div className="flex flex-wrap items-end justify-center gap-6 rounded-2xl border border-border/40 bg-background/40 p-6 backdrop-blur">
          <QuestionProgressContainer current={3}   max={10}     theme="blue"   width={140} />
          <QuestionProgressContainer current={5}   max={10}     theme="orange" width={140} />
          <QuestionProgressContainer current={7}   max={10}     theme="green"  width={140} />
          <QuestionProgressContainer current={6}   max={10}     theme="purple" width={140} />
          <QuestionProgressContainer current={2}   max={10}     theme="blue"   width={140} />
          <QuestionProgressContainer current={614} max={2000}   theme="gold"   width={140} />
          <QuestionProgressContainer current={100} max={100}    theme="green"  width={140} />
          <QuestionProgressContainer current={0}   max={100}    theme="purple" width={140} />
        </div>
      </section>
    </main>
  );
};

export default QuestionProgressContainerEditor;
