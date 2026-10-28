// Curriculum data structure for MathGPL.
// Topics and subtopics are intentionally empty — they will be filled in manually
// by the project owner. The search index reads from this file automatically.

export type Subtopic = {
  slug: string;
  /** Display name. Capitalized (e.g. "Completing the Square"). */
  name: string;
  /** Optional external/internal game link. */
  gameUrl?: string;
};

export type Topic = {
  slug: string;
  /** Display name. ALL CAPS (e.g. "FACTORIZATION"). */
  name: string;
  subtopics: Subtopic[];
};

export type SubjectCurriculum = {
  slug: string;
  /** Display name for the subject. */
  name: string;
  topics: Topic[];
};

export const curriculum: SubjectCurriculum[] = [
  {
    slug: "algebra",
    name: "Algebra",
    topics: [
      {
        slug: "numbers-and-numerals",
        name: "NUMBERS AND NUMERALS",
        subtopics: [
          { slug: "tally-marks", name: "Tally Marks", gameUrl: "/games/tally" },
          { slug: "roman-numerals", name: "Roman Numerals", gameUrl: "/games/roman" },
          { slug: "abacus", name: "Abacus", gameUrl: "/subjects/algebra/numbers-and-numerals/abacus" },
          { slug: "place-value", name: "Place Value Challenge", gameUrl: "/games/place-value" },
        ],
      },
      {
        slug: "basic-operations-on-whole-numbers",
        name: "BASIC OPERATIONS ON WHOLE NUMBERS",
        subtopics: [
          { slug: "addition", name: "Addition Carry Challenge", gameUrl: "/games/addition" },
          { slug: "subtraction", name: "Subtraction Borrow Challenge", gameUrl: "/games/subtraction" },
          { slug: "multiplication", name: "Long Multiplication Builder", gameUrl: "/games/multiplication" },
          { slug: "division", name: "Long Division Builder", gameUrl: "/games/division" },
          { slug: "factors", name: "Factor Quest", gameUrl: "/games/factors" },
          { slug: "common-factors", name: "Common Factors Lab", gameUrl: "/games/common-factors" },
          { slug: "prime", name: "Prime Lab", gameUrl: "/games/prime" },
          { slug: "prime-factors", name: "Prime Factors Lab", gameUrl: "/games/prime-factors" },
          { slug: "bidmas", name: "BIDMAS Workspace", gameUrl: "/games/bidmas" },
          { slug: "lcm", name: "LCM Lab", gameUrl: "/games/lcm" },
        ],
      },
      {
        slug: "fractions",
        name: "FRACTIONS",
        subtopics: [
          { slug: "improper-to-mixed", name: "Improper → Mixed", gameUrl: "/games/fractions/improper-to-mixed" },
          { slug: "mixed-to-improper", name: "Mixed → Improper", gameUrl: "/games/fractions/mixed-to-improper" },
          { slug: "mathboard", name: "MathBoard Engine", gameUrl: "/mathboard" },
          { slug: "fraction-challenge-addition", name: "Fraction Challenge: Addition", gameUrl: "/games/fraction-challenge/addition" },
          { slug: "fraction-challenge-subtraction", name: "Fraction Challenge: Subtraction", gameUrl: "/games/fraction-challenge/subtraction" },
         { slug: "fraction-challenge-mixed", name: "Fraction Challenge: Add & Subtract", gameUrl: "/games/fraction-challenge/mixed" },
         { slug: "fraction-challenge-multiplication", name: "Fraction Challenge: Multiplication", gameUrl: "/games/fraction-challenge/multiplication" },
         { slug: "fraction-challenge-division", name: "Fraction Challenge: Division", gameUrl: "/games/fraction-challenge/division" },
         { slug: "fraction-challenge-mul-div", name: "Fraction Challenge: Multiply & Divide", gameUrl: "/games/fraction-challenge/mul-div" },
        ],
      },
      {
        slug: "decimals",
        name: "DECIMALS",
        subtopics: [
          { slug: "decimal-frac-to-dec", name: "Fraction to Decimal Challenge", gameUrl: "/games/decimals/frac-to-dec" },
          { slug: "decimal-dec-to-frac", name: "Decimal to Fraction Challenge", gameUrl: "/games/decimals/dec-to-frac" },
          { slug: "decimal-add", name: "Decimal Addition Challenge", gameUrl: "/games/decimals/add" },
          { slug: "decimal-sub", name: "Decimal Subtraction Challenge", gameUrl: "/games/decimals/sub" },
          { slug: "decimal-mul", name: "Decimal Multiplication Challenge", gameUrl: "/games/decimals/mul" },
          { slug: "decimal-div", name: "Decimal Division Challenge", gameUrl: "/games/decimals/div" },
          { slug: "decimal-mixed", name: "Decimal Mixed Operations Challenge", gameUrl: "/games/decimals/mixed" },
        ],
      },
    ],
  },
  { slug: "geometry", name: "Geometry", topics: [] },
  { slug: "trigonometry", name: "Trigonometry", topics: [] },
  { slug: "statistics", name: "Statistics", topics: [] },
  { slug: "calculus", name: "Calculus", topics: [] },
];

export type SearchResult = {
  kind: "topic" | "subtopic";
  label: string;
  subjectSlug: string;
  subjectName: string;
  topicSlug: string;
  topicName: string;
  subtopicSlug?: string;
  href: string;
};

/** Case-insensitive "contains" search across all topics and subtopics. */
export const searchCurriculum = (query: string, limit = 10): SearchResult[] => {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: SearchResult[] = [];

  for (const subject of curriculum) {
    for (const topic of subject.topics) {
      if (topic.name.toLowerCase().includes(q)) {
        results.push({
          kind: "topic",
          label: topic.name,
          subjectSlug: subject.slug,
          subjectName: subject.name,
          topicSlug: topic.slug,
          topicName: topic.name,
          href: `/subjects/${subject.slug}/${topic.slug}`,
        });
      }
      for (const sub of topic.subtopics) {
        if (sub.name.toLowerCase().includes(q)) {
          results.push({
            kind: "subtopic",
            label: sub.name,
            subjectSlug: subject.slug,
            subjectName: subject.name,
            topicSlug: topic.slug,
            topicName: topic.name,
            subtopicSlug: sub.slug,
            href: `/subjects/${subject.slug}/${topic.slug}/${sub.slug}`,
          });
        }
      }
    }
  }

  return results.slice(0, limit);
};

export const findSubject = (slug: string) =>
  curriculum.find((s) => s.slug === slug);

export const findTopic = (subjectSlug: string, topicSlug: string) =>
  findSubject(subjectSlug)?.topics.find((t) => t.slug === topicSlug);

export const findSubtopic = (
  subjectSlug: string,
  topicSlug: string,
  subtopicSlug: string,
) =>
  findTopic(subjectSlug, topicSlug)?.subtopics.find(
    (s) => s.slug === subtopicSlug,
  );
