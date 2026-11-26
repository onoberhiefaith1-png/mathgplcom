/**
 * Algebra practice games for Math Lab, read from the curriculum.
 * The curriculum file stays the only list of names and links.
 */
import { curriculum, type SubjectCurriculum, type Subtopic } from "@/data/curriculum";

export type CurriculumGame = {
  slug: string;
  name: string;
  /** Existing game route or hub. Null when the curriculum has not linked one yet. */
  href: string | null;
  comingSoon: boolean;
};

export type CurriculumGameGroup = {
  slug: string;
  /** Topic name as stored in the curriculum. */
  sourceName: string;
  /** Readable heading derived from the stored name. */
  name: string;
  games: CurriculumGame[];
};

const SMALL_WORDS = new Set(["and", "on", "of", "the", "to"]);

/** "BASIC OPERATIONS ON WHOLE NUMBERS" → "Basic Operations on Whole Numbers". */
export function curriculumHeading(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && SMALL_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function gameFrom(subtopic: Subtopic): CurriculumGame {
  const href = subtopic.gameUrl?.trim() || null;
  return { slug: subtopic.slug, name: subtopic.name, href, comingSoon: !href };
}

/** The Algebra topics and their practice games, in curriculum order. */
export function algebraCurriculumGames(source: readonly SubjectCurriculum[] = curriculum): CurriculumGameGroup[] {
  const algebra = source.find((subject) => subject.slug === "algebra");
  if (!algebra) return [];
  return algebra.topics.map((topic) => ({
    slug: topic.slug,
    sourceName: topic.name,
    name: curriculumHeading(topic.name),
    games: topic.subtopics.map(gameFrom),
  }));
}
