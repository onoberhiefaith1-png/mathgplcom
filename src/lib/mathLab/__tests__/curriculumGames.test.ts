import { describe, expect, it } from "vitest";
import { curriculum, type SubjectCurriculum } from "@/data/curriculum";
import { algebraCurriculumGames, curriculumHeading } from "../curriculumGames";

describe("algebra curriculum games", () => {
  const groups = algebraCurriculumGames();

  it("groups the curriculum into the four Algebra topics, in order", () => {
    expect(groups.map((group) => group.slug)).toEqual([
      "numbers-and-numerals",
      "basic-operations-on-whole-numbers",
      "fractions",
      "decimals",
    ]);
    expect(groups.map((group) => group.name)).toEqual([
      "Numbers and Numerals",
      "Basic Operations on Whole Numbers",
      "Fractions",
      "Decimals",
    ]);
  });

  it("reads names and links from curriculum.ts", () => {
    const algebra = curriculum.find((subject) => subject.slug === "algebra");
    expect(algebra).toBeTruthy();
    algebra!.topics.forEach((topic, index) => {
      expect(groups[index].sourceName).toBe(topic.name);
      expect(groups[index].games.map((game) => game.name)).toEqual(topic.subtopics.map((sub) => sub.name));
      expect(groups[index].games.map((game) => game.href)).toEqual(topic.subtopics.map((sub) => sub.gameUrl ?? null));
    });
  });

  it("links Abacus to its hub and the operation games to their routes", () => {
    const games = Object.fromEntries(groups.flatMap((group) => group.games.map((game) => [game.slug, game])));
    expect(games.abacus).toMatchObject({
      name: "Abacus",
      href: "/subjects/algebra/numbers-and-numerals/abacus",
      comingSoon: false,
    });
    expect(games.addition.href).toBe("/games/addition");
    expect(games["fraction-challenge-addition"].href).toBe("/games/fraction-challenge/addition");
    expect(games["fraction-challenge-subtraction"].href).toBe("/games/fraction-challenge/subtraction");
    expect(games["fraction-challenge-mixed"].href).toBe("/games/fraction-challenge/mixed");
    expect(games["fraction-challenge-multiplication"].href).toBe("/games/fraction-challenge/multiplication");
    expect(games["fraction-challenge-division"].href).toBe("/games/fraction-challenge/division");
    expect(games["fraction-challenge-mul-div"].href).toBe("/games/fraction-challenge/mul-div");
  });

  it("marks a curriculum entry with no game link as coming soon", () => {
    const source: SubjectCurriculum[] = [{
      slug: "algebra",
      name: "Algebra",
      topics: [{
        slug: "fractions",
        name: "FRACTIONS",
        subtopics: [
          { slug: "later", name: "A future fraction game" },
          { slug: "ready", name: "Ready game", gameUrl: "/games/ready" },
        ],
      }],
    }];
    const [fractions] = algebraCurriculumGames(source);
    expect(fractions.games[0]).toEqual({
      slug: "later",
      name: "A future fraction game",
      href: null,
      comingSoon: true,
    });
    expect(fractions.games[1].comingSoon).toBe(false);
  });

  it("does not invent topics that are not in the curriculum", () => {
    expect(algebraCurriculumGames([])).toEqual([]);
    expect(curriculumHeading("NUMBERS AND NUMERALS")).toBe("Numbers and Numerals");
  });
});
