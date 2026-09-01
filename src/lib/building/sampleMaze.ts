/**
 * SAMPLE MAZE — a ready-made branching hallway layout.
 *
 * The building is a loop-free tree: each junction offers at most one forward,
 * one left and one right continuation, and each hallway carries several doors.
 * This blueprint gives the owner an immediately walkable maze (and a full map)
 * without changing any navigation or rendering behaviour — it only writes rows
 * through the existing API, so everything stays editable afterwards.
 */
import { addDoor, addWalkway, updateDoor, updateWalkway } from "./api";
import { DOOR_STYLES } from "./doors";
import type { WalkwayDirection } from "./types";

interface MazeNode {
  /** blueprint key, used to attach children */
  key: string;
  name: string;
  parent: string | null;
  direction: WalkwayDirection;
  endLabel?: string;
  doors: string[];
}

export const SAMPLE_MAZE: MazeNode[] = [
  { key: "main", name: "Main Hallway", parent: null, direction: "forward", doors: ["Reception", "Mathematics", "Science"] },
  { key: "north", name: "North Hallway", parent: "main", direction: "forward", endLabel: "North End", doors: ["Algebra", "Geometry"] },
  { key: "west", name: "West Hallway", parent: "main", direction: "left", doors: ["Number", "Fractions", "Ratio"] },
  { key: "east", name: "East Hallway", parent: "main", direction: "right", doors: ["Statistics", "Probability", "Trigonometry"] },
  { key: "westAnnexe", name: "West Annexe", parent: "west", direction: "forward", endLabel: "West End", doors: ["Games Room", "Adventure"] },
  { key: "eastAnnexe", name: "East Annexe", parent: "east", direction: "right", endLabel: "East End", doors: ["Assessments", "Past Papers"] },
  { key: "science", name: "Science Corridor", parent: "east", direction: "forward", endLabel: "Laboratory", doors: ["Physics", "Chemistry"] },
  { key: "library", name: "Library Corridor", parent: "north", direction: "left", endLabel: "Library End", doors: ["Library", "Reading Room"] },
  { key: "games", name: "Games Corridor", parent: "north", direction: "right", endLabel: "Games End", doors: ["Arcade", "Puzzles", "Challenge"] },
];

/** Evenly spaced positions along a hallway, so doors never overlap. */
const spread = (count: number, i: number) => (i + 1) / (count + 1);

/**
 * Write the sample maze into a building. Existing hallways are kept: the maze
 * is attached beneath the given parent (or as the root when the building is
 * still empty).
 */
export async function createSampleMaze(
  buildingId: string,
  rootParentId: string | null = null,
): Promise<void> {
  const ids = new Map<string, string>();
  let styleIndex = 0;

  for (const node of SAMPLE_MAZE) {
    const parentId = node.parent === null ? rootParentId : (ids.get(node.parent) ?? null);
    const walkwayId = await addWalkway(buildingId, parentId, node.direction, node.name);
    if (!walkwayId) continue;
    ids.set(node.key, walkwayId);
    if (node.endLabel) await updateWalkway(walkwayId, { end_label: node.endLabel });

    for (let i = 0; i < node.doors.length; i += 1) {
      const doorId = await addDoor(buildingId, walkwayId, {
        position_along: spread(node.doors.length, i),
        title_override: node.doors[i],
      });
      if (!doorId) continue;
      const style = DOOR_STYLES[styleIndex % DOOR_STYLES.length].key;
      styleIndex += 1;
      await updateDoor(doorId, { design: { style } as never });
    }
  }
}
