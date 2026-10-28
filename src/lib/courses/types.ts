// Course Builder — the shapes shared by the editor, the library and the
// Student View. A Course is the top-level object: everything else lives
// inside it (Background, Sections, Settings).

export type CourseStatus = "draft" | "published";
export type LearningMode = "locked" | "unlocked";
export type CompletionMode = "retracement" | "deadline";
export type CertificateMode = "automatic" | "approval";
export type BackgroundKind = "none" | "image" | "video";

export interface Course {
  id: string;
  owner_id: string;
  title: string;
  subject: string;
  topic: string;
  subtopic: string;
  description: string;
  background_kind: BackgroundKind;
  background_url: string | null;
  status: CourseStatus;
  learning_mode: LearningMode;
  completion_mode: CompletionMode;
  pass_mark: number;
  deadline_days: number;
  learning_days: number;
  certificate_mode: CertificateMode;
}

export interface CourseSection {
  id: string;
  course_id: string;
  title: string;
  position: number;
}

/** Colour identity is part of the block kind — students recognise a block
 *  type before reading its title. */
export type BlockKind = "video" | "exercise" | "text" | "conclusion";

export interface VideoConfig {
  title?: string;
  /** Pasted link (YouTube / Vimeo / any URL) or an uploaded storage path. */
  source?: "link" | "upload";
  url?: string;
  storagePath?: string;
  durationMins?: number;
}

export interface ExerciseConfig {
  name?: string;
  topic?: string;
  subtopic?: string;
  totalMarks?: number;
  passMark?: number;
}

export interface TextConfig {
  heading?: string;
  body?: string;
}

export type BlockConfig = VideoConfig & ExerciseConfig & TextConfig;

export interface CourseBlock {
  id: string;
  section_id: string;
  kind: BlockKind;
  position: number;
  config: BlockConfig;
}

export interface CourseExerciseQuestion {
  id: string;
  block_id: string;
  position: number;
  notebook_id: string | null;
  subsection_id: string | null;
  section_id: string | null;
  question_key: string | null;
  label: string;
  total_marks: number;
  /** This link's own frozen copy of the question. Once set, the Lesson Note is
   *  never read again for this question. */
  assigned_question_id?: string | null;
}

/** Everything the editor and the Student View render from. */
export interface CourseTree {
  course: Course;
  sections: CourseSection[];
  blocks: CourseBlock[];
  questions: CourseExerciseQuestion[];
}

export const BLOCK_LABEL: Record<BlockKind, string> = {
  video: "Video",
  exercise: "Exercise Card",
  text: "Text",
  conclusion: "Conclusion",
};

/** Colour identity per block kind (student-facing recognition). */
export const BLOCK_ACCENT: Record<BlockKind, string> = {
  video: "border-sky-300/60 bg-sky-500/10 text-sky-100",
  exercise: "border-amber-300/60 bg-amber-500/10 text-amber-100",
  text: "border-slate-200/60 bg-white/10 text-slate-100",
  conclusion: "border-emerald-300/60 bg-emerald-500/10 text-emerald-100",
};

export const defaultBlockConfig = (kind: BlockKind): BlockConfig => {
  if (kind === "video") return { title: "New video", source: "link", url: "" };
  if (kind === "exercise")
    return { name: "Practice Set A", topic: "", subtopic: "", totalMarks: 0, passMark: 80 };
  if (kind === "conclusion") return { heading: "Well done", body: "" };
  return { heading: "Introduction", body: "" };
};
