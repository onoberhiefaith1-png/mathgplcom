// Multi-subject Asset Library data model. Each subject is plain data:
// sections of entries. Mathematics keeps its own registry (ALL_ASSETS).

export type SubjectId = "mathematics" | "physics" | "chemistry" | "engineering" | "accounting" | "economics";

export type EntryStatus = "ready" | "pending";

export interface SubjectEntry {
  id: string;
  /** Text inserted / displayed, with real sub/superscript characters. */
  symbol: string;
  meaning: string;
  unit?: string;
  /** Other meanings in other topics (context-dependent symbols). */
  alsoMeans?: string[];
  example?: string;
  status?: EntryStatus;
  /** Symbol filled in by us where the source document left it blank. */
  review?: boolean;
}

export interface SubjectSection {
  id: string;
  name: string;
  desc?: string;
  entries: SubjectEntry[];
}

export interface SubjectLibrary {
  id: SubjectId;
  name: string;
  status: "ready" | "coming-soon";
  sections: SubjectSection[];
}
