import { Link, useParams } from "@/lib/router-compat";
import { findSubject, findTopic } from "@/data/curriculum";
import SeamlessBackground from "@/components/SeamlessBackground";

const TopicSubtopics = () => {
  const { subject = "", topic = "" } = useParams();
  const subjectData = findSubject(subject);
  const topicData = findTopic(subject, topic);

  if (!subjectData || !topicData) {
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
      <SeamlessBackground file="obsidian.png" repeat={6} />
      <div className="absolute inset-0 -z-10 bg-background/70" />
      <header className="relative z-10 flex items-start justify-between p-5 sm:p-8">
        <div>
          <p className="text-xs uppercase tracking-[0.45em] text-primary sm:text-sm">
            {subjectData.name} · {topicData.name}
          </p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-5xl">Subtopics</h1>
        </div>
        <Link
          to={`/subjects/${subjectData.slug}`}
          className="text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          Back to topics
        </Link>
      </header>

      <section className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-4 px-6 pb-24 pt-6">
        {topicData.subtopics.length === 0 ? (
          <p className="rounded-md border border-border/40 bg-background/50 px-6 py-10 text-center text-sm text-muted-foreground backdrop-blur">
            No subtopics yet for {topicData.name}. Subtopics will be added here.
          </p>
        ) : (
          topicData.subtopics.map((sub) => (
            <Link
              key={sub.slug}
              to={sub.gameUrl ?? `/subjects/${subjectData.slug}/${topicData.slug}/${sub.slug}`}
              className="group w-full rounded-lg border border-primary/30 bg-background/60 px-6 py-4 text-center text-foreground backdrop-blur transition hover:border-primary hover:bg-background/80 hover:text-primary"
            >
              {sub.name}
            </Link>
          ))
        )}
      </section>
    </main>
  );
};

export default TopicSubtopics;
