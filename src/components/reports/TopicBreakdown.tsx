// Topic → Subtopic performance bars. Used by both report modes.

import CompletionBar from "./CompletionBar";
import type { SubtopicStat, TopicStat } from "@/lib/reports/studentReport";

export const StatRows = ({
  stats,
  onSelect,
}: {
  stats: SubtopicStat[];
  onSelect?: (name: string) => void;
}) => (
  <div className="space-y-2.5">
    {stats.map((s) => (
      <div
        key={s.name}
        className={`grid grid-cols-[minmax(96px,1fr)_2fr] items-center gap-3 ${onSelect ? "cursor-pointer" : ""}`}
        onClick={onSelect ? () => onSelect(s.name) : undefined}
      >
        <span className="truncate text-sm">{s.name}</span>
        <CompletionBar percent={s.percent} />
      </div>
    ))}
  </div>
);

const TopicBreakdown = ({
  title,
  topics,
  activeTopic,
  onTopicSelect,
}: {
  title: string;
  topics: TopicStat[];
  activeTopic?: string | null;
  onTopicSelect?: (name: string) => void;
}) => {
  if (!topics.length) {
    return (
      <div className="rounded-xl border border-dashed border-[hsl(var(--rp-border))] px-4 py-8 text-center text-sm text-[hsl(var(--rp-muted))]">
        No topic data recorded yet.
      </div>
    );
  }
  const active = topics.find((t) => t.name === activeTopic) ?? topics[0];
  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--rp-muted))]">
          {title}
        </h3>
        <StatRows stats={topics} onSelect={onTopicSelect} />
      </section>
      {active?.subtopics?.length ? (
        <section>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--rp-muted))]">
            By subtopic ({active.name})
          </h3>
          <StatRows stats={active.subtopics} />
        </section>
      ) : null}
    </div>
  );
};

export default TopicBreakdown;
