import { Link, Navigate, useParams } from "@/lib/router-compat";
import { findLevel, resolveLevelId, levelLabel } from "@/data/levels";

type Mode = "level" | "age" | "grade" | "year" | "class";

const LevelContent = ({ mode }: { mode: Mode }) => {
  const params = useParams();
  const id = resolveLevelId({
    level: mode === "level" ? params.id : undefined,
    age: mode === "age" ? params.range : undefined,
    grade: mode === "grade" ? params.n : undefined,
    year: mode === "year" ? params.n : undefined,
    ngClass: mode === "class" ? params.code : undefined,
  });

  if (!id) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6 text-center text-foreground">
        <div>
          <p className="mb-4 text-muted-foreground">Unknown level.</p>
          <Link to="/" className="text-primary underline-offset-4 hover:underline">
            Return to academy
          </Link>
        </div>
      </main>
    );
  }

  // Aliases canonicalize to /levels/:id — single folder, no duplicates.
  if (mode !== "level") {
    return <Navigate to={`/levels/${id}`} replace />;
  }

  const level = findLevel(id)!;

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground animate-fade-in">
      <img
        src={level.background}
        alt={`Level ${level.id} backdrop`}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/55 via-background/35 to-background/85" />
      <div className="relative z-10">
      <header className="flex items-start justify-between p-5 sm:p-8">
        <div>
          <p className="text-xs uppercase tracking-[0.45em] text-primary sm:text-sm">
            Level {level.id}
          </p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-5xl">
            Age {level.ageRange}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {levelLabel(level)}
          </p>
        </div>
        <Link
          to="/"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          Return to academy
        </Link>
      </header>

      <section className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-6 pb-24 pt-6">
        {level.topics.length === 0 ? (
          <p className="rounded-md border border-border/40 bg-background/50 px-6 py-10 text-center text-sm text-muted-foreground backdrop-blur">
            No topics yet for Level {level.id}. Topics will be added here.
          </p>
        ) : (
          level.topics.map((topic) => (
            <Link
              key={topic.slug}
              to={topic.href ?? "#"}
              className="group w-full rounded-lg border border-primary/30 bg-background/60 px-6 py-4 text-center uppercase tracking-[0.25em] text-foreground backdrop-blur transition hover:border-primary hover:bg-background/80 hover:text-primary"
            >
              {topic.name}
            </Link>
          ))
        )}
      </section>
      </div>
    </main>
  );
};

export default LevelContent;
