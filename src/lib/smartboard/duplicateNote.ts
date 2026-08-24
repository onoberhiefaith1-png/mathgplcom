// duplicateNote — makes an INDEPENDENT working copy of a lesson-note document.
//
// Board B is the teacher's rough-work copy of the lesson note. It must start as
// an exact duplicate (headings, text, equations, diagrams, graphs, tables,
// solutions, order) and then live entirely on its own: editing or deleting an
// object on the copy must never reach the master note.
//
// Text content is copied verbatim. Only the *identity* attributes are re-minted,
// consistently across the whole document, so per-note object records (diagram
// scenes, question ownership, highlight targets) of the master are never the
// same rows the copy writes to.

const ID_ATTRS = [
  "diagramId",
  "sectionId",
  "ownerQuestionId",
  "ownerDiagramId",
  "subsectionId",
  "spacerId",
  "blockId",
  "graphId",
  "tableId",
  "questionId",
] as const;

const newId = () =>
  `wc-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;

const isPlainObject = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === "object" && !Array.isArray(v);

/** Deep clone `doc`, remapping every identity attribute through a shared map so
 *  cross-references inside the copy stay intact while pointing at fresh ids. */
export function duplicateNoteDoc(doc: any): any {
  if (!doc) return null;
  const map = new Map<string, string>();
  const remap = (value: string) => {
    const existing = map.get(value);
    if (existing) return existing;
    const minted = newId();
    map.set(value, minted);
    return minted;
  };

  const walk = (node: any): any => {
    if (Array.isArray(node)) return node.map(walk);
    if (!isPlainObject(node)) return node;
    const out: Record<string, any> = {};
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === "string" && value && (ID_ATTRS as readonly string[]).includes(key)) {
        out[key] = remap(value);
      } else {
        out[key] = walk(value);
      }
    }
    return out;
  };

  return walk(doc);
}

/** True when a stored document holds no real content (so Board B may be seeded). */
export function isEmptyDoc(doc: any): boolean {
  if (!doc) return true;
  const content = doc?.content;
  if (!Array.isArray(content) || content.length === 0) return true;
  if (content.length === 1) {
    const only = content[0];
    if (only?.type === "paragraph" && (!only.content || only.content.length === 0)) return true;
  }
  return false;
}
