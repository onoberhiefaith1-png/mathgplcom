// Stage 1 — material intake.
//
// Typed text, voice transcription, photos and documents all merge into ONE
// material bundle. Voice is never a separate generation route: it is
// transcribed into the same instruction text before it gets here.

import type { Material, MaterialFile, TeacherContext } from "./types";

export const EMPTY_MATERIAL: Material = { text: "", images: [], files: [] };

export const fileToMaterialFile = (f: File): Promise<MaterialFile> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () =>
      resolve({
        name: f.name,
        mime: f.type || "application/octet-stream",
        dataUrl: String(r.result),
      });
    r.onerror = reject;
    r.readAsDataURL(f);
  });

export const mergeMaterial = (
  text: string,
  images: string[] = [],
  files: MaterialFile[] = [],
): Material => ({ text: text.trim(), images, files });

export const hasMaterial = (m: Material | undefined | null): boolean =>
  !!m && Boolean(m.text.trim() || m.images.length || m.files.length);

/** Human summary of what was supplied — used in prompts and in the blueprint. */
export const describeMaterialSource = (m: Material): string => {
  const parts: string[] = [];
  if (m.text.trim()) parts.push("teacher instruction");
  if (m.images.length) parts.push(`${m.images.length} image${m.images.length > 1 ? "s" : ""}`);
  if (m.files.length) parts.push(m.files.map((f) => f.name).join(", "));
  return parts.join(" + ") || "no material";
};

/** Compile the Add Context strip into prompt constraints. */
export function describeTeacherContext(c: TeacherContext): string {
  const lines: string[] = [];
  if (c.topic.trim()) lines.push(`Topic (hard constraint — never drift outside it): ${c.topic.trim()}`);
  if (c.subtopic.trim()) {
    lines.push(
      `Subtopic (hard constraint — the question MUST actually require this): ${c.subtopic.trim()}`,
    );
  }
  if (c.level.trim()) lines.push(`Class / level: ${c.level.trim()}`);
  if (c.difficulty) {
    const structural: Record<string, string> = {
      easy: "one mathematical relationship only",
      medium: "two or three connected relationships",
      hard: "several connected stages",
      very_hard: "a multi-stage chain where each result feeds the next step",
    };
    lines.push(
      `Difficulty: ${c.difficulty.replace("_", " ")} — difficulty is STRUCTURAL ` +
        `(${structural[c.difficulty]}), never merely larger numbers.`,
    );
  }
  if (c.count > 1) lines.push(`Number of questions: ${c.count}`);
  if (c.diagramRequired === true) lines.push("A mathematical diagram is required.");
  if (c.diagramRequired === false) lines.push("No diagram is required.");
  if (c.reuse === "reproduce") {
    lines.push("Reuse mode: REPRODUCE the supplied question faithfully (clean it up, do not change the mathematics).");
  }
  if (c.reuse === "modify") {
    lines.push("Reuse mode: MODIFY the supplied question as the teacher instructs, keeping its mathematical structure.");
  }
  if (c.reuse === "similar") {
    lines.push(
      "Reuse mode: SIMILAR — preserve the mathematical structure of the supplied question " +
        "(same objects, relationships, methods, answer format) and change only the values, context and labels.",
    );
  }
  if (c.notes.trim()) lines.push(`Extra instruction: ${c.notes.trim()}`);
  return lines.length ? `TEACHER CONTEXT:\n${lines.map((l) => `• ${l}`).join("\n")}` : "";
}
