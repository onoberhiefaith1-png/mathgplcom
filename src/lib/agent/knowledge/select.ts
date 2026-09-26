// Which workflows matter for where the teacher is standing right now.
//
// The full map is too large to send every turn, so the index always travels and
// the entries for the current surface are written out in full.

const RULES: { match: RegExp; ids: string[] }[] = [
  { match: /^\/auth/, ids: ["accounts", "workspaces"] },
  { match: /^\/(login|signup|welcome|join)/, ids: ["accounts", "roster", "classes"] },
  { match: /^\/(home|index)?$/, ids: ["building", "workspaces", "classes"] },
  { match: /^\/(buildings|homepage|backgrounds)/, ids: ["building", "workspaces"] },
  {
    match: /^\/lesson-notes\/[^/]+\/floating\/[^/]+\/test/,
    ids: ["floating-test", "floating-numbers", "smartboard", "assign-question", "lesson-sections"],
  },
  {
    match: /^\/lesson-notes\/[^/]+\/floating-prep/,
    ids: ["floating-preparation", "floating-numbers", "lesson-sections", "lesson-notes"],
  },
  {
    match: /^\/lesson-notes\/[^/]+\/floating/,
    ids: [
      "floating-numbers",
      "floating-preparation",
      "floating-test",
      "lesson-sections",
      "lesson-notes",
      "smartboard",
      "assign-question",
    ],
  },
  {
    match: /^\/lesson-notes/,
    ids: [
      "lesson-notes",
      "lesson-note-page",
      "lesson-note-toolbar",
      "lesson-note-assets",
      "lesson-note-emojis",
      "lesson-sections",
      "floating-preparation",
      "floating-numbers",
      "floating-test",
      "assign-question",
      "smartboard",
    ],
  },

  { match: /^\/(mathboard|smartboard)/, ids: ["smartboard", "floating-numbers", "lesson-notes", "live"] },
  { match: /smartboard/, ids: ["smartboard", "floating-numbers", "lesson-notes", "live"] },
  { match: /^\/live/, ids: ["live", "smartboard", "classes", "lesson-notes"] },
  { match: /^\/(course-builder|course-edit)/, ids: ["courses", "lesson-notes", "classes"] },
  { match: /courses/, ids: ["courses", "lesson-notes", "assignments"] },
  { match: /assignments/, ids: ["assignments", "lesson-notes", "assessments", "classes"] },
  { match: /assessments/, ids: ["assessments", "assignments", "reports", "lesson-notes"] },
  { match: /adventure/, ids: ["adventures", "lesson-notes", "classes", "roster"] },
  { match: /^\/(game|games|levels|challenge|card)/, ids: ["slate-game", "lesson-notes", "classes"] },
  { match: /report/, ids: ["reports", "assessments", "roster"] },
  { match: /students/, ids: ["roster", "classes", "reports"] },
  { match: /^\/teaching-hub\/classes\/create/, ids: ["classes", "roster", "lesson-notes"] },
  { match: /^\/teaching-hub\/settings/, ids: ["settings", "workspaces"] },
  { match: /^\/(teaching-hub|class|c)\b/, ids: ["classes", "roster", "lesson-notes", "assignments"] },
  { match: /^\/(school|family|student|academy|account|admin)/, ids: ["workspaces", "accounts", "reports"] },
  { match: /^\/community/, ids: ["community", "lesson-notes", "courses", "adventures"] },
];

/** Always present, whatever page is open. */
const BASELINE = ["lesson-notes", "classes"];

export function knowledgeForPath(path: string | null | undefined): string[] {
  const p = (path ?? "").split("?")[0] ?? "";
  const hits: string[] = [];
  for (const rule of RULES) {
    if (rule.match.test(p)) hits.push(...rule.ids);
  }
  const all = hits.length ? [...hits, ...BASELINE] : [...BASELINE, "building", "smartboard"];
  return Array.from(new Set(all));
}
