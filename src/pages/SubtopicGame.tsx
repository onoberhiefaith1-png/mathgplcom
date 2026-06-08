import { Link, useParams } from "react-router-dom";
import { findSubject, findSubtopic, findTopic } from "@/data/curriculum";

const SubtopicGame = () => {
  const { subject = "", topic = "", subtopic = "" } = useParams();
  const subjectData = findSubject(subject);
  const topicData = findTopic(subject, topic);
  const subtopicData = findSubtopic(subject, topic, subtopic);

  if (!subjectData || !topicData || !subtopicData) {
    return (
      <main className="cinematic-sky flex min-h-screen items-center justify-center p-6 text-center">
        <Link className="text-primary underline-offset-4 hover:underline" to="/">
          Return to the academy
        </Link>
      </main>
    );
  }

  return (
    <main className="cinematic-sky relative min-h-screen overflow-hidden text-foreground animate-fade-in">
      <header className="relative z-10 flex items-start justify-between p-5 sm:p-8">
        <div>
          <p className="text-xs uppercase tracking-[0.45em] text-primary sm:text-sm">
            {subjectData.name} · {topicData.name}
          </p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-5xl">
            {subtopicData.name}
          </h1>
        </div>
        <Link
          to={`/subjects/${subjectData.slug}/${topicData.slug}`}
          className="text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          Back to subtopics
        </Link>
      </header>

      <section className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 pb-24 pt-10">
        {subtopicData.gameUrl ? (
          <a
            href={subtopicData.gameUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-primary bg-primary/10 px-8 py-4 text-lg font-semibold text-primary transition hover:bg-primary/20"
          >
            Open game
          </a>
        ) : (
          <p className="rounded-md border border-border/40 bg-background/50 px-6 py-10 text-center text-sm text-muted-foreground backdrop-blur">
            No game linked yet for {subtopicData.name}.
          </p>
        )}
      </section>
    </main>
  );
};

export default SubtopicGame;
