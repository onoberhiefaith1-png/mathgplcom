// Unified level system.
// There are 6 internal content levels. Each level has ONE content folder.
// Multiple labels (Age, Grade, Year, Class) are ALIASES that resolve to the same
// level — they must NEVER duplicate content.

export type LevelId = 1 | 2 | 3 | 4 | 5 | 6;

export type LevelTopic = {
  slug: string;
  name: string;
  /** Optional internal route or external URL. */
  href?: string;
};

export type Level = {
  id: LevelId;
  ageRange: string;
  usGrade: number;
  ukYear: number;
  ngClass: string;
  /** Background image used on the level's content page (no folder is blank). */
  background: string;
  /** The single content folder for this level. */
  topics: LevelTopic[];
};

import algebraImage from "@/assets/academy/algebra.png";
import geometryImage from "@/assets/academy/geometry.png";
import trigonometryImage from "@/assets/academy/trigonometry.png";
import statisticsImage from "@/assets/academy/statistics.png";
import calculusImage from "@/assets/academy/calculus.png";
import academyBackground from "@/assets/academy_background.png";

export const levels: Level[] = [
  {
    id: 1,
    ageRange: "11–12",
    usGrade: 6,
    ukYear: 7,
    ngClass: "JSS1",
    background: algebraImage,
    topics: [
      { slug: "tally-marks", name: "Tally Marks", href: "/games/tally" },
      { slug: "roman-numerals", name: "Roman Numerals", href: "/games/roman" },
      { slug: "abacus", name: "Abacus", href: "/subjects/algebra/numbers-and-numerals/abacus" },
    ],
  },
  { id: 2, ageRange: "12–13", usGrade: 7, ukYear: 8, ngClass: "JSS2", background: geometryImage, topics: [] },
  { id: 3, ageRange: "13–14", usGrade: 8, ukYear: 9, ngClass: "JSS3", background: trigonometryImage, topics: [] },
  { id: 4, ageRange: "14–15", usGrade: 9, ukYear: 10, ngClass: "SS1", background: statisticsImage, topics: [] },
  { id: 5, ageRange: "15–16", usGrade: 10, ukYear: 11, ngClass: "SS2", background: calculusImage, topics: [] },
  { id: 6, ageRange: "16–17", usGrade: 11, ukYear: 12, ngClass: "SS3", background: academyBackground, topics: [] },
];

export const findLevel = (id: number): Level | undefined =>
  levels.find((l) => l.id === id);

/** Resolve any alias to a level id. Returns undefined if no match. */
export const resolveLevelId = (params: {
  level?: string | number;
  age?: string;
  grade?: string | number;
  year?: string | number;
  ngClass?: string;
}): LevelId | undefined => {
  if (params.level != null) {
    const n = Number(params.level);
    return levels.find((l) => l.id === n)?.id;
  }
  if (params.age) {
    const norm = params.age.replace("-", "–");
    return levels.find((l) => l.ageRange === norm)?.id;
  }
  if (params.grade != null) {
    const n = Number(params.grade);
    return levels.find((l) => l.usGrade === n)?.id;
  }
  if (params.year != null) {
    const n = Number(params.year);
    return levels.find((l) => l.ukYear === n)?.id;
  }
  if (params.ngClass) {
    const c = params.ngClass.toUpperCase();
    return levels.find((l) => l.ngClass.toUpperCase() === c)?.id;
  }
  return undefined;
};

export const levelLabel = (l: Level) =>
  `Level ${l.id} · Age ${l.ageRange} · Grade ${l.usGrade} · Year ${l.ukYear} · ${l.ngClass}`;
