// Smartboard writing profiles — handwriting personalities for math on the board.
// Each profile maps to CSS variables consumed by <WritingSurface>.

export type WritingProfileId =
  | "clean-classroom"
  | "chalk-mathematics"
  | "smart-pen"
  | "exam-solution"
  | "student-handwriting";

export interface WritingProfile {
  id: WritingProfileId;
  label: string;
  blurb: string;
  /** Font-family stack applied to text & math on the board. */
  fontStack: string;
  letterSpacing: string;
  lineHeight: number;
  weight: number;
  /** 0..1 micro-thickness/opacity jitter per character. */
  strokeJitter: number;
  /** Base ink opacity (0..1). */
  inkOpacity: number;
  /** Edge softness (0..1) — drives SVG filter intensity. */
  edgeSoftness: number;
  /** Draw-on reveal duration in ms. */
  revealSpeed: number;
}

export const WRITING_PROFILES: Record<WritingProfileId, WritingProfile> = {
  "clean-classroom": {
    id: "clean-classroom",
    label: "Clean Classroom",
    blurb: "Experienced teacher. Calm rhythm. Highly readable.",
    fontStack: "'Patrick Hand','Kalam','Caveat',cursive",
    letterSpacing: "0.01em",
    lineHeight: 1.85,
    weight: 400,
    strokeJitter: 0.06,
    inkOpacity: 0.96,
    edgeSoftness: 0.15,
    revealSpeed: 520,
  },
  "chalk-mathematics": {
    id: "chalk-mathematics",
    label: "Chalk Mathematics",
    blurb: "Dusty edges, uneven pressure. Traditional blackboard.",
    fontStack: "'Gloria Hallelujah','Architects Daughter','Patrick Hand',cursive",
    letterSpacing: "0.02em",
    lineHeight: 1.95,
    weight: 400,
    strokeJitter: 0.18,
    inkOpacity: 0.88,
    edgeSoftness: 0.55,
    revealSpeed: 640,
  },
  "smart-pen": {
    id: "smart-pen",
    label: "Premium Smart Pen",
    blurb: "Smooth digital ink. Elegant curvature.",
    fontStack: "'Caveat','Shadows Into Light','Patrick Hand',cursive",
    letterSpacing: "0em",
    lineHeight: 1.7,
    weight: 600,
    strokeJitter: 0.04,
    inkOpacity: 1,
    edgeSoftness: 0.05,
    revealSpeed: 440,
  },
  "exam-solution": {
    id: "exam-solution",
    label: "Exam Solution",
    blurb: "Compact. Structured. Official worked-solution feel.",
    fontStack: "'Architects Daughter','Patrick Hand','Kalam',cursive",
    letterSpacing: "0.015em",
    lineHeight: 1.75,
    weight: 400,
    strokeJitter: 0.05,
    inkOpacity: 0.94,
    edgeSoftness: 0.1,
    revealSpeed: 360,
  },
  "student-handwriting": {
    id: "student-handwriting",
    label: "Student Handwriting",
    blurb: "Slightly imperfect. Natural human rhythm.",
    fontStack: "'Indie Flower','Just Another Hand','Caveat',cursive",
    letterSpacing: "0.02em",
    lineHeight: 1.9,
    weight: 400,
    strokeJitter: 0.14,
    inkOpacity: 0.93,
    edgeSoftness: 0.25,
    revealSpeed: 580,
  },
};

export const PROFILE_LIST: WritingProfile[] = [
  WRITING_PROFILES["clean-classroom"],
  WRITING_PROFILES["chalk-mathematics"],
  WRITING_PROFILES["smart-pen"],
  WRITING_PROFILES["exam-solution"],
  WRITING_PROFILES["student-handwriting"],
];

export const DEFAULT_PROFILE_ID: WritingProfileId = "clean-classroom";

export const PROFILE_STORAGE_KEY = "smartboard:writing-profile";
