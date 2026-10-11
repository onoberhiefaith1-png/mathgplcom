// The MathGPL map: what the app is, built from its own page list and action
// registry, so the talking brain knows where everything lives. Pure and shared.
import { PAGES, type Command, type Known } from "./matcher";

/** Which screen each registered action lives on, so Tutor can open it itself. */
export type Screen = "notes_list" | "note" | "floating" | "guide";
export const ACTION_SCREEN: Record<string, Screen> = {
  "notes.create": "notes_list",
  "copilot.open": "note",
  "copilot.send": "note",
  "copilot.proceed": "note",
  "aiedit.open": "note",
  "aiedit.run": "note",
  "floating.generate": "floating",
  "floating.delete": "floating",
  "floating.move": "floating",
  "floating.merge": "floating",
  "floating.together": "floating",
  "guide.start": "guide",
  "guide.stop": "guide",
};

/** The path that opens a screen, or null when Tutor needs more to go there. */
export function screenPath(screen: Screen, ctx: { noteId?: string | null }): string | null {
  if (screen === "notes_list") return "/lesson-notes";
  if (screen === "note") return ctx.noteId ? `/lesson-notes/${ctx.noteId}` : null;
  return null; // Floating Numbers and Guide open from a specific question.
}

/** The note open in the current URL, if any. */
export function noteIdFromPath(path: string): string | null {
  const m = path.match(/\/lesson-notes\/([0-9a-f-]{36})/i);
  return m ? m[1]! : null;
}

export const COMMAND_KINDS = [
  "navigate", "open_class", "open_note", "make_note", "copilot_say", "proceed", "ai_edit",
  "floating_generate", "floating_delete", "floating_move", "floating_merge", "floating_together",
  "guide_start", "guide_stop", "send_queue", "snapshot", "create_class", "link_game", "link_note",
  "archive_note", "answer", "clarify",
] as const;

/** What the open screen reported (see publishScreen in actions.ts). */
export type ScreenView = { page: string; question: string | null; hasSolution: boolean; available: string[] };

/** The ON SCREEN NOW block: tells the brain what is already open. */
export function describeScreen(s: ScreenView | null | undefined): string {
  if (!s) return "ON SCREEN NOW: unknown";
  return [
    "ON SCREEN NOW (already open — never ask the teacher to open these):",
    `page: ${s.page}`,
    s.question ? `question open: ${s.question}` : "question open: none",
    s.page === "question" ? `saved solution: ${s.hasSolution ? "yes" : "no"}` : "",
    `actions ready here: ${s.available.join(", ") || "(none)"}`,
  ].filter(Boolean).join("\n");
}

/** Compact description of MathGPL handed to the brain on every turn. */
export function describeApp(known: Known, here: string, screen?: ScreenView | null): string {
  const list = (xs: { id: string; name: string }[]) => xs.slice(0, 60).map((x) => `${x.id}|${x.name}`).join("\n") || "(none)";
  return [
    "PAGES (path = label):",
    [...new Map(PAGES.map((p) => [p.path + p.label, `${p.path} = ${p.label}`])).values()].join("\n"),
    "",
    "ACTIONS:",
    "navigate(path,label) open a page · open_class(id) · open_note(id) · make_note(topic,subtopic?,className?,extra?) opens Create Note and hands it to Copilot",
    "copilot_say(text) send instructions to Copilot in the open/named note · proceed: tell Copilot to proceed",
    "ai_edit(instruction, id? note) edit the document or a table through AI Edit",
    "floating_generate · floating_delete(n) · floating_move(from,to) · floating_merge(numbers) · floating_together(a,b) — on the open Floating Numbers screen",
    "guide_start / guide_stop — step-by-step spoken guide (tutorial) of the question open on screen",
    "create_class(name) · link_game(id game, classId) · link_note(id note, classId) · archive_note(id) · snapshot: workspace summary · send_queue: offline saved actions",
    "answer(reply) explain how MathGPL works · clarify(reply) ask ONE short question when truly ambiguous",
    "",
    `CURRENT PAGE: ${here}`,
    describeScreen(screen),
    "CLASSES (id|name):", list(known.classes),
    "NOTES (id|title):", list(known.notes),
    "GAMES (id|title):", list(known.games),
  ].join("\n");
}

export type BrainPick = {
  kind: string; reply: string | null; path: string | null; label: string | null; id: string | null;
  classId: string | null; topic: string | null; subtopic: string | null; className: string | null;
  extra: string | null; text: string | null; instruction: string | null; n: number | null;
  from: number | null; to: number | null; numbers: number[] | null; a: string | null; b: string | null;
};

export type Understood = { command: Command | null; reply: string | null; noteId: string | null };

/** Turn the brain's pick into a safe Command; unknown ids/paths are rejected. */
export function toCommand(p: BrainPick, known: Known): Understood {
  const s = (v: string | null) => (v ?? "").trim();
  const byId = (xs: { id: string; name: string }[], id: string | null) => xs.find((x) => x.id === id);
  const note = byId(known.notes, p.id);
  const cls = byId(known.classes, p.kind === "open_class" ? p.id : p.classId);
  const out = (command: Command | null, reply: string | null = p.reply) => ({ command, reply, noteId: note?.id ?? null });
  switch (p.kind) {
    case "navigate": {
      const page = PAGES.find((x) => x.path === s(p.path));
      return page ? out({ kind: "navigate", path: page.path, label: page.label }) : out(null);
    }
    case "open_class": return cls ? out({ kind: "open_class", classId: cls.id, name: cls.name }) : out(null);
    case "open_note": return note ? out({ kind: "open_note", noteId: note.id, name: note.name }) : out(null);
    case "make_note": return s(p.topic) ? out({ kind: "make_note", topic: s(p.topic), subtopic: s(p.subtopic) || undefined, className: s(p.className) || undefined, extra: s(p.extra) || undefined }) : out(null);
    case "copilot_say": return s(p.text) ? out({ kind: "copilot_say", text: s(p.text) }) : out(null);
    case "proceed": return out({ kind: "proceed" });
    case "ai_edit": return s(p.instruction) ? out({ kind: "ai_edit", instruction: s(p.instruction) }) : out(null);
    case "floating_generate": return out({ kind: "floating_generate" });
    case "floating_delete": return p.n ? out({ kind: "floating_delete", n: p.n }) : out(null);
    case "floating_move": return p.from && p.to ? out({ kind: "floating_move", from: p.from, to: p.to }) : out(null);
    case "floating_merge": return p.numbers?.length ? out({ kind: "floating_merge", numbers: p.numbers }) : out(null);
    case "floating_together": return s(p.a) && s(p.b) ? out({ kind: "floating_together", a: s(p.a), b: s(p.b) }) : out(null);
    case "guide_start": return out({ kind: "guide_start" });
    case "guide_stop": return out({ kind: "guide_stop" });
    case "send_queue": return out({ kind: "send_queue" });
    case "snapshot": return out({ kind: "snapshot" });
    case "create_class": return s(p.label ?? p.text) ? out({ kind: "create_class", name: s(p.label ?? p.text) }) : out(null);
    case "link_game": {
      const g = byId(known.games, p.id);
      return g && cls ? out({ kind: "link_game", gameId: g.id, classId: cls.id, label: `${g.name} to ${cls.name}` }) : out(null);
    }
    case "link_note": return note && cls ? out({ kind: "link_note", noteId: note.id, classId: cls.id, label: `${note.name} to ${cls.name}` }) : out(null);
    case "archive_note": return note ? out({ kind: "archive_note", noteId: note.id, name: note.name }) : out(null);
    default: return out(null); // answer / clarify: speak the reply only
  }
}
