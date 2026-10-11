// MathGPL Tutor's brain: picks one catalogued command from what the teacher said.
// Pure, on-device, no network and no model, so it costs nothing and works offline.

export type Entity = { id: string; name: string };
export type Known = { classes: Entity[]; notes: Entity[]; games: Entity[] };

export type Command =
  | { kind: "navigate"; path: string; label: string }
  | { kind: "list_classes" }
  | { kind: "list_notes" }
  | { kind: "list_games" }
  | { kind: "snapshot" }
  | { kind: "create_class"; name: string }
  | { kind: "open_class"; classId: string; name: string }
  | { kind: "open_note"; noteId: string; name: string }
  | { kind: "make_note"; topic: string; subtopic?: string; className?: string; extra?: string }
  | { kind: "copilot_say"; text: string }
  | { kind: "proceed" }
  | { kind: "ai_edit"; instruction: string }
  | { kind: "floating_generate" }
  | { kind: "floating_delete"; n: number }
  | { kind: "floating_move"; from: number; to: number }
  | { kind: "floating_merge"; numbers: number[] }
  | { kind: "floating_together"; a: string; b: string }
  | { kind: "guide_start" }
  | { kind: "guide_stop" }
  | { kind: "send_queue" }
  | { kind: "link_game"; gameId: string; classId: string; label: string }
  | { kind: "link_note"; noteId: string; classId: string; label: string }
  | { kind: "archive_note"; noteId: string; name: string }
  | { kind: "help" }
  | { kind: "ask"; question: string; options: Command[] }
  | { kind: "unknown"; suggestions: string[] };

/** Commands that change data always need a Confirm tap. */
export const needsConfirm = (c: Command) =>
  c.kind === "create_class" || c.kind === "link_game" || c.kind === "link_note" || c.kind === "archive_note";

export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(please|can you|could you|i want to|i want|kindly|for me|now|the|my|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lev(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]!;
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j]!;
      d[j] = Math.min(d[j]! + 1, d[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length]!;
}

/** Does the word appear, allowing one small typo on longer words? */
const has = (words: string[], target: string) =>
  words.some((w) => w === target || w === `${target}s` || (target.length > 4 && lev(w, target) <= 1));

/** Best named item mentioned in the text (fuzzy), or null. */
export function findEntity(text: string, items: Entity[]): Entity | null {
  const t = ` ${normalise(text)} `;
  let best: { e: Entity; score: number } | null = null;
  for (const e of items) {
    const n = normalise(e.name);
    if (!n) continue;
    let score = 0;
    if (t.includes(` ${n} `)) score = 100 + n.length;
    else {
      const parts = n.split(" ").filter((p) => p.length > 1);
      const words = t.trim().split(" ");
      const hit = parts.filter((p) => has(words, p)).length;
      if (parts.length && hit === parts.length) score = 50 + hit;
      else if (hit > 0 && hit / parts.length >= 0.5) score = 10 + hit;
    }
    if (score > 0 && (!best || score > best.score)) best = { e, score };
  }
  return best?.e ?? null;
}

export const PAGES: { words: string[]; path: string; label: string }[] = [
  { words: ["academia"], path: "/school/academia", label: "Academia" },
  { words: ["staff", "hub"], path: "/staff-hub", label: "Staff Hub" },
  { words: ["community"], path: "/community", label: "Community" },
  { words: ["live"], path: "/live", label: "MathGPL Live" },
  { words: ["teaching", "hub"], path: "/teaching-hub", label: "Teaching Hub" },
  { words: ["smartboard"], path: "/smartboard", label: "Smartboard" },
  { words: ["plans"], path: "/plans", label: "Plans" },
  { words: ["account"], path: "/account", label: "Account" },
  { words: ["building"], path: "/", label: "My building" },
  { words: ["home"], path: "/", label: "Home" },
  { words: ["games"], path: "/game", label: "Games" },
  { words: ["game"], path: "/game", label: "Games" },
  { words: ["lesson", "notes"], path: "/lesson-notes", label: "Lesson notes" },
  { words: ["notes"], path: "/lesson-notes", label: "Lesson notes" },
];

const NUM_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, last: -1 };
/** Numbers said in words or digits, in order. */
export function numbersIn(raw: string): number[] {
  return (raw.toLowerCase().match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|first|second|third|fourth|fifth|sixth)\b/g) ?? [])
    .map((w) => (/^\d+$/.test(w) ? Number(w) : NUM_WORDS[w]!));
}

const SYMBOLS: Record<string, string> = { equal: "=", equals: "=", equality: "=", fraction: "/", plus: "+", minus: "-", times: "×", bracket: "(" };

/** Parse "create a lesson note on X, subtopic Y, for class Z [— extra]". */
export function parseNoteRequest(raw: string): { topic: string; subtopic?: string; className?: string; extra?: string } | null {
  const m = raw.match(/\b(?:create|make|write|generate|prepare|new|build)\b.*?\b(?:lesson\s*note|note|lesson)s?\b\s*(?:on|about|for|titled)?\s+(.+)$/i);
  if (!m?.[1]) return null;
  let rest = m[1].trim();
  const out: { topic: string; subtopic?: string; className?: string; extra?: string } = { topic: "" };
  const extra = rest.match(/\s*(?:[,.;]\s*)?\b(?:with|include|and add|add)\b\s+(.+)$/i);
  if (extra) { out.extra = extra[1]!.trim(); rest = rest.slice(0, extra.index).trim(); }
  const cls = rest.match(/\s*,?\s*\b(?:for|in)\s+(?:class\s+)?((?:jss|ss|sss|year|grade|primary|basic|class)\s*\w+[\w\s]*?)\s*$/i) ?? rest.match(/\s*,?\s*\bclass\s+(.+)$/i);
  if (cls) { out.className = cls[1]!.trim(); rest = rest.slice(0, cls.index).trim(); }
  const sub = rest.match(/\s*,?\s*\bsub\s*-?topic\s*(?:is|:|of)?\s+(.+)$/i);
  if (sub) { out.subtopic = sub[1]!.trim(); rest = rest.slice(0, sub.index).trim(); }
  out.topic = rest.replace(/^(?:topic\s*(?:is|:)?\s*)/i, "").replace(/[,.;]+$/, "").trim();
  return out.topic ? out : null;
}

const STANDARD_SUBTOPICS: Record<string, string> = {
  set: "Set notation and types of sets",
  sets: "Set notation and types of sets",
  "set notation": "Describing sets and set-builder notation",
  "linear equations": "Solving linear equations in one variable",
  "quadratic equations": "Solving by factorisation",
  "simultaneous equations": "Elimination and substitution",
  fractions: "Adding and subtracting fractions",
  indices: "Laws of indices",
  statistics: "Mean, median and mode",
  variance: "Variance and standard deviation",
};
/** "Any subtopic": a standard first subtopic for the topic. */
export function pickSubtopic(topic: string): string {
  const k = topic.toLowerCase().trim();
  return STANDARD_SUBTOPICS[k] ?? `Introduction to ${topic.trim()}`;
}

const SUGGESTIONS = [
  "Open my classes",
  "Create a class called JSS2",
  "Open lesson notes",
  "Create a lesson note on set notation",
  "Generate floating numbers",
  "Guide me through this question",
  "Go to Academia",
];

export function matchCommand(raw: string, known: Known): Command {
  const text = normalise(raw);
  const words = text.split(" ").filter(Boolean);
  if (!words.length) return { kind: "unknown", suggestions: SUGGESTIONS };
  const any = (...w: string[]) => w.some((x) => has(words, x));

  const lower = raw.toLowerCase();
  if (any("help") || /what can you do/.test(lower)) return { kind: "help" };

  if (/^\s*(proceed|go ahead|continue|approve|yes,? proceed|build it|start building)\b/.test(lower)) return { kind: "proceed" };
  if (/\b(send|sync)\b.*\b(saved|queued|waiting|pending)\b/.test(lower)) return { kind: "send_queue" };

  const tell = raw.match(/^\s*(?:tell|ask)\s+(?:the\s+)?co-?pilot\s+(?:to\s+|that\s+)?(.+)$/i)
    ?? raw.match(/^\s*(?:i need|i want|add|use|give me|include)\s+(.+\b(?:example|solution|question|exercise|diagram|table|explanation)s?\b.*)$/i);
  if (tell?.[1]) return { kind: "copilot_say", text: tell[1].trim() };

  const edit = raw.match(/^\s*(?:ai\s*edit\s*[:,]?\s*|edit\s+this\s*[:,]?\s*)(.+)$/i)
    ?? raw.match(/^\s*((?:make|change|replace|rewrite|simplify|remove|fix|correct|shorten)\b.*\b(?:this|section|part|sentence|example|explanation|paragraph|line)\b.*)$/i);
  if (edit?.[1] && !/\bfloating\b|\blesson\s*note\b|\bnote\s+on\b/i.test(raw)) return { kind: "ai_edit", instruction: edit[1].trim() };

  if (/\bfloating\b|\bchips?\b/.test(lower)) {
    const n = numbersIn(raw);
    if (/\b(generate|create|make)\b/.test(lower)) return { kind: "floating_generate" };
    if (/\b(delete|remove)\b/.test(lower) && n.length) return { kind: "floating_delete", n: n[0]! };
    if (/\bmerge|join|combine\b/.test(lower) && n.length >= 2) {
      const range = lower.match(/(\d+)\s*(?:to|-|through)\s*(\d+)/);
      const nums = range ? Array.from({ length: Number(range[2]) - Number(range[1]) + 1 }, (_, i) => Number(range[1]) + i) : n;
      return { kind: "floating_merge", numbers: nums };
    }
    if (/\b(move|put)\b/.test(lower) && n.length >= 2) return { kind: "floating_move", from: n[0]!, to: n[1]! };
  }
  const together = lower.match(/\bkeep\s+(?:the\s+)?(\w+)\s+(?:sign\s+)?and\s+(?:the\s+)?(\w+)\s+(?:sign\s+)?together/);
  if (together && SYMBOLS[together[1]!] && SYMBOLS[together[2]!]) return { kind: "floating_together", a: SYMBOLS[together[1]!]!, b: SYMBOLS[together[2]!]! };

  if (/\b(guide|demonstrate|show me how|walk me through|teach (?:it|this)|solve it step)\b/.test(lower)) {
    return /\b(stop|end|close)\b/.test(lower) ? { kind: "guide_stop" } : { kind: "guide_start" };
  }

  // Create a class "called/named X"
  const createClass = raw.match(/\b(?:create|make|add|new|start|set up)\b.*?\bclass\b(?:\s+(?:called|named|for))?\s+["“]?([^"”]+?)["”]?\s*$/i);
  if (createClass && createClass[1] && !/^(and|with)\b/i.test(createClass[1])) {
    return { kind: "create_class", name: createClass[1].trim() };
  }

  // Make a lesson note on X → Copilot
  const noteReq = !any("open", "show") ? parseNoteRequest(raw) : null;
  if (noteReq) return { kind: "make_note", ...noteReq };

  const cls = findEntity(raw, known.classes);
  const note = findEntity(raw, known.notes);
  const game = findEntity(raw, known.games);

  if (any("archive", "delete", "remove") && note) return { kind: "archive_note", noteId: note.id, name: note.name };

  if (any("link", "add", "assign", "attach", "put", "share")) {
    if (game && cls) return { kind: "link_game", gameId: game.id, classId: cls.id, label: `${game.name} → ${cls.name}` };
    if (note && cls) return { kind: "link_note", noteId: note.id, classId: cls.id, label: `${note.name} → ${cls.name}` };
    if ((any("game") || any("note")) && !cls && known.classes.length) {
      return {
        kind: "ask",
        question: "Which class?",
        options: known.classes.slice(0, 6).map((c) => ({ kind: "open_class", classId: c.id, name: c.name })),
      };
    }
  }

  if (any("summary", "workspace", "overview", "everything")) return { kind: "snapshot" };

  const opening = any("open", "show", "go", "take", "see", "view", "list", "display", "find") || words.length <= 3;
  if (opening) {
    if (cls && !any("note", "notes", "game")) return { kind: "open_class", classId: cls.id, name: cls.name };
    if (note) return { kind: "open_note", noteId: note.id, name: note.name };
    if (any("class", "classes")) return { kind: "list_classes" };
    if (any("lesson") && any("note", "notes")) return { kind: "list_notes" };
    for (const p of PAGES) if (p.words.every((w) => has(words, w))) return { kind: "navigate", path: p.path, label: p.label };
  }

  return { kind: "unknown", suggestions: SUGGESTIONS };
}
