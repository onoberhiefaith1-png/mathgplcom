import { describe, expect, it } from "vitest";
import { pickNeighbours } from "../activityOrder";

const rows = [
  { id: "a", assessment_id: "x", game_id: "g" },
  { id: "b", assessment_id: "y", game_id: null },
  { id: "c", assessment_id: "z", game_id: "g2" },
];

describe("Academia activity chain", () => {
  it("Play continues to the next activity that has a Game", () => {
    expect(pickNeighbours(rows, "a", "play").next?.id).toBe("c");
  });
  it("the last Play has no next", () => {
    expect(pickNeighbours(rows, "c", "play").next).toBeNull();
  });
  it("Practice steps through every activity with a question", () => {
    const n = pickNeighbours(rows, "b", "practice");
    expect([n.prev?.id, n.next?.id, n.index, n.total]).toEqual(["a", "c", 1, 3]);
  });
});

describe("Practice, Play and standalone Adventure categories", () => {
 const mixed = [
  {id:"q1",kind:"question",assessment_id:"a",game_id:"g"},
  {id:"adventure",kind:"adventure",assessment_id:"legacy-a",game_id:"embedded-g"},
  {id:"mcq",kind:"mcq",assessment_id:null,game_id:"legacy-game"},
  {id:"q2",kind:"question",assessment_id:"b",game_id:"g2"},
 ];
 it("Practice goes question → MCQ → question without entering Adventure",()=>{
  expect(pickNeighbours(mixed,"q1","practice").next?.id).toBe("mcq");
  const n=pickNeighbours(mixed,"mcq","practice"); expect([n.prev?.id,n.next?.id,n.total]).toEqual(["q1","q2",3]);
 });
 it("Play skips MCQs even with a legacy game id, and skips Adventures",()=>{
  expect(pickNeighbours(mixed,"q1","play").next?.id).toBe("q2");
  expect(pickNeighbours(mixed,"q1","play").total).toBe(2);
 });
 it("an Adventure cannot enter either chain",()=>{
  for(const mode of ["play","practice"] as const) expect(pickNeighbours(mixed,"adventure",mode).index).toBe(-1);
 });
});
