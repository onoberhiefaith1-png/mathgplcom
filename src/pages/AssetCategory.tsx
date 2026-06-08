import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, Folder } from "lucide-react";
import SeamlessBackground from "@/components/SeamlessBackground";
import { getCategory } from "@/data/assets";

const AssetCategory = () => {
  const { category } = useParams();
  const cat = getCategory(category);

  if (!cat) return <Navigate to="/assets" replace />;

  return (
    <main className="relative min-h-screen text-foreground animate-fade-in">
      <SeamlessBackground file={cat.background} />

      <header className="relative z-10 flex items-center justify-between p-5 sm:p-8">
        <div>
          <p className="text-xs uppercase tracking-[0.45em] text-primary sm:text-sm drop-shadow">
            Assets
          </p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-5xl drop-shadow">
            {cat.name}
          </h1>
        </div>
        <Link
          to="/assets"
          className="inline-flex items-center gap-2 rounded-full bg-background/60 px-3 py-1.5 text-sm text-foreground backdrop-blur underline-offset-4 hover:text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </header>

      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {cat.subcategories.map((s) => (
            <Link
              key={s.slug}
              to={`/assets/${cat.slug}/${s.slug}`}
              className="group flex flex-col items-center gap-3 rounded-xl border border-border/40 bg-background/50 p-6 backdrop-blur transition hover:border-primary/60 hover:bg-background/70"
            >
              <Folder className="h-9 w-9 text-primary transition-transform group-hover:scale-110" />
              <div className="text-sm font-semibold text-center">{s.name}</div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
};

export default AssetCategory;
