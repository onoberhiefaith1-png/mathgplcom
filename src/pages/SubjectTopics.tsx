import { Link, useParams } from "react-router-dom";
import subjectChannelImage from "@/assets/academy_subject_channel.png";
import { findSubject } from "@/data/curriculum";

const SubjectTopics = () => {
  const { subject = "" } = useParams();
  const matched = findSubject(subject);

  if (!matched) {
    return (
      <main className="cinematic-sky flex min-h-screen items-center justify-center p-6 text-center">
        <Link className="text-primary underline-offset-4 hover:underline" to="/">
          Return to the academy
        </Link>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground animate-fade-in">
      <img
        src={subjectChannelImage}
        alt={`${matched.name} descending channel`}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/30 to-background/85" />

      <header className="relative z-10 flex items-start justify-between p-5 sm:p-8">
        <div>
          <p className="text-xs uppercase tracking-[0.45em] text-primary sm:text-sm">
            {matched.name}
          </p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-5xl">Topics</h1>
        </div>
        <Link
          to="/"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          Return to academy
        </Link>
      </header>

      <section className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-4 px-6 pb-24 pt-6">
        {matched.topics.length === 0 ? (
          <p className="rounded-md border border-border/40 bg-background/50 px-6 py-10 text-center text-sm text-muted-foreground backdrop-blur">
            No topics yet for {matched.name}. Topics will be added here.
          </p>
        ) : (
          matched.topics.map((topic) => (
            <Link
              key={topic.slug}
              to={`/subjects/${matched.slug}/${topic.slug}`}
              className="group w-full rounded-lg border border-primary/30 bg-background/60 px-6 py-4 text-center uppercase tracking-[0.25em] text-foreground backdrop-blur transition hover:border-primary hover:bg-background/80 hover:text-primary"
            >
              {topic.name}
            </Link>
          ))
        )}
      </section>
    </main>
  );
};

export default SubjectTopics;
