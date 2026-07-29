import { Link } from "@/lib/router-compat";
import { ArrowLeft } from "lucide-react";

const backgrounds = [
  { name: "Golden", file: "golden.png" },
  { name: "Silver", file: "silver.png" },
  { name: "Bronze", file: "bronze.png" },
  { name: "Crystal", file: "crystal.png" },
  { name: "Emerald", file: "emerald.png" },
  { name: "Ice", file: "ice.png" },
  { name: "Obsidian", file: "obsidian.png" },
  { name: "Sandstone", file: "sandstone.png" },
  { name: "Ember", file: "ember.png" },
  { name: "Ivory", file: "ivory.png" },
  { name: "Royal Gold", file: "royal-gold.png" },
  { name: "Arcane", file: "arcane.png" },
];

const Backgrounds = () => (
  <main className="relative min-h-screen bg-background text-foreground animate-fade-in">
    <header className="flex items-center justify-between p-5 sm:p-8">
      <div>
        <p className="text-xs uppercase tracking-[0.45em] text-primary sm:text-sm">
          Gallery
        </p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-5xl">Backgrounds</h1>
      </div>
      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-full bg-background/60 px-3 py-1.5 text-sm text-foreground backdrop-blur underline-offset-4 hover:text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
    </header>

    <section className="mx-auto max-w-6xl px-6 pb-24">
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {backgrounds.map((b) => (
          <figure
            key={b.file}
            className="overflow-hidden rounded-xl border border-border/40 bg-card"
          >
            <div className="aspect-[2/3] w-full overflow-hidden">
              <img
                src={`/assets/backgrounds/${b.file}`}
                alt={`${b.name} background`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <figcaption className="px-3 py-2 text-center text-sm font-medium">
              {b.name}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  </main>
);

export default Backgrounds;
