// MathGPL Tutor: a free talking conductor for teachers. Listening and speaking
// use the device's own voice; understanding runs on the device. It never writes
// mathematics — it fills forms and hands work to Copilot, AI Edit, Floating
// Numbers and the Guide through their registered actions. Zero AI credits itself.
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { GraduationCap, Mic, Send, Volume2, VolumeX, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useAccount } from "@/lib/accounts/useAccount";
import { findEntity, matchCommand, needsConfirm, pickSubtopic, type Command, type Known } from "@/lib/assistant/matcher";
import { runAssistantAction } from "@/lib/assistant/assistant.functions";
import { callTutorAction, hasTutorAction, screenSummary, waitForTutorAction } from "@/lib/assistant/actions";
import { AWAIT_MS, AwaitingSlot, isFollowUp } from "@/lib/assistant/followUp";
import { understandRequest } from "@/lib/assistant/understand.functions";
import { ACTION_SCREEN, noteIdFromPath, screenPath, toCommand } from "@/lib/assistant/appMap";
import { dequeue, enqueue, readQueue, type QueuedAction } from "@/lib/assistant/queue";

const KNOWN_KEY = "mathgpl:auralite:known";
const SPEAK_KEY = "mathgpl:auralite:speak";
const STAFF_ROLES = ["teacher", "school", "platform_owner", "co_admin"];

type Line = { who: "you" | "tutor"; text: string; options?: Command[]; confirm?: Command; queued?: QueuedAction[] };
type NoteDraft = { topic: string; subtopic?: string; className?: string; extra?: string };
type Pending = { slot: "subtopic" | "class"; draft: NoteDraft } | null;

const emptyKnown: Known = { classes: [], notes: [], games: [] };

function describe(c: Command): string {
  switch (c.kind) {
    case "create_class": return `Create the class "${c.name}"?`;
    case "link_game": case "link_note": return `Add ${c.label}?`;
    case "archive_note": return `Archive "${c.name}"?`;
    case "open_class": return c.name;
    default: return "";
  }
}

export default function MathGPLTutor() {
  const { session, ready } = useAuth();
  const { role } = useAccount();
  const navigate = useNavigate();
  const run = useServerFn(runAssistantAction);
  const understand = useServerFn(understandRequest);
  const here = useRouterState({ select: (st) => st.location.pathname });
  const lastNote = useRef<string | null>(null);
  useEffect(() => { const id = noteIdFromPath(here); if (id) lastNote.current = id; }, [here]);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [speak, setSpeak] = useState(true);
  const [listening, setListening] = useState(false);
  const known = useRef<Known>(emptyKnown);
  const pending = useRef<Pending>(null);
  const awaiting = useRef(new AwaitingSlot());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const k = localStorage.getItem(KNOWN_KEY);
      if (k) known.current = JSON.parse(k) as Known;
      setSpeak(localStorage.getItem(SPEAK_KEY) !== "off");
    } catch { /* ignore */ }
  }, []);

  const say = useCallback((text: string, extra?: Partial<Line>) => {
    setLines((l) => [...l, { who: "tutor", text, ...extra }]);
    if (speak && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    }
  }, [speak]);

  const refreshKnown = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    try {
      const [c, n, g] = await Promise.all([
        run({ data: { toolId: "list_classes" } }),
        run({ data: { toolId: "list_lesson_notes", args: { limit: 100 } } }),
        run({ data: { toolId: "list_teaching_hub_games" } }),
      ]);
      const pick = (r: { json: string }, key: string) => {
        const d = JSON.parse(r.json) as unknown;
        return (Array.isArray(d) ? (d as Record<string, unknown>[]) : [])
          .map((x) => ({ id: String(x["id"] ?? ""), name: String(x[key] ?? x["name"] ?? x["title"] ?? "") }))
          .filter((x) => x.id && x.name);
      };
      known.current = { classes: pick(c, "name"), notes: pick(n, "title"), games: pick(g, "title") };
      localStorage.setItem(KNOWN_KEY, JSON.stringify(known.current));
    } catch { /* offline or not allowed: keep cached names */ }
  }, [run]);

  useEffect(() => { if (open) { void refreshKnown(); inputRef.current?.focus(); } }, [open, refreshKnown]);

  // Back online: offer the actions saved while offline (the teacher confirms).
  useEffect(() => {
    const onOnline = () => {
      const q = readQueue();
      if (q.length) { setOpen(true); say(`You're back online. ${q.length} saved action${q.length > 1 ? "s are" : " is"} waiting.`, { queued: q }); }
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [say]);

  const action = useCallback(async (toolId: string, args: Record<string, unknown> = {}, label = "") => {
    if (!navigator.onLine) {
      enqueue({ toolId, args, label: label || toolId });
      say("You're offline, so I've saved that. I'll ask you to send it when you're connected.");
      return;
    }
    const r = await run({ data: { toolId, args } });
    if (!r.ok) { say(r.error ?? "That didn't work."); return; }
    say(r.summary ?? "Done.");
    if (r.navigateTo) void navigate({ to: r.navigateTo as never });
    void refreshKnown();
  }, [navigate, refreshKnown, run, say]);

  const sendQueued = useCallback(async (item: QueuedAction) => {
    if (!navigator.onLine) { say("Still offline."); return; }
    const r = await run({ data: { toolId: item.toolId, args: item.args } });
    if (r.ok) dequeue(item.id);
    say(r.ok ? (r.summary ?? `Sent: ${item.label}.`) : (r.error ?? "That didn't send."));
  }, [run, say]);

  /** Bus call with a spoken result. */
  const bus = useCallback(async (name: string, args: Record<string, unknown> = {}, wait = 0) => {
    // Go there itself: open the screen the action lives on, then wait for it.
    if (!(await waitForTutorAction(name, wait || 50))) {
      const screen = ACTION_SCREEN[name];
      const path = screen ? screenPath(screen, { noteId: lastNote.current }) : null;
      if (!path) {
        const view = screenSummary();
        if (screen === "note") { say("Which lesson note? Tell me its name and I'll open it."); return false; }
        if (view.page === "question" && !view.hasSolution) { say("This question has no saved solution yet, so I can't guide it step by step."); return false; }
        // Keep the request waiting: it runs once the screen appears or the teacher says "done".
        awaiting.current.set(name, args);
        say(screen === "floating" ? "Open the question's Floating Numbers and I'll do it straight away." : "Open the question and I'll start as soon as it's on screen.");
        void waitForTutorAction(name, AWAIT_MS).then(async (ready) => {
          const w = awaiting.current.peek();
          if (!ready || !w || w.name !== name) return;
          awaiting.current.clear();
          const r = await callTutorAction(name, w.args);
          if (r.say) say(r.say);
        });
        return false;
      }
      void navigate({ to: path as never });
      if (!(await waitForTutorAction(name, 15000))) { say("That screen didn't open in time. Please try again."); return false; }
    }
    awaiting.current.clear();
    const r = await callTutorAction(name, args);
    if (r.say) say(r.say);
    return r.ok;
  }, [navigate, say]);

  /** Create Note → open the note → hand to Copilot. */
  const createNote = useCallback(async (draft: NoteDraft) => {
    if (!draft.subtopic) { pending.current = { slot: "subtopic", draft }; say(`Which subtopic of ${draft.topic}? Say "any" and I'll choose one.`); return; }
    if (!draft.className && known.current.classes.length) {
      pending.current = { slot: "class", draft };
      say("Which class is this for?", { options: known.current.classes.slice(0, 6).map((c) => ({ kind: "open_class", classId: c.id, name: c.name })) });
      return;
    }
    if (!navigator.onLine) { say("Creating a note with Copilot needs the internet. Please try again when you're connected."); return; }
    say(`Creating a lesson note on ${draft.topic}, ${draft.subtopic}${draft.className ? `, for ${draft.className}` : ""}.`);
    void navigate({ to: "/lesson-notes" as never });
    const made = await bus("notes.create", { topic: draft.topic, subtopic: draft.subtopic, class_name: draft.className ?? "" }, 10000);
    if (!made) return;
    if (!(await bus("copilot.open", {}, 15000))) return;
    const ask = `Create a lesson note on ${draft.topic}, subtopic ${draft.subtopic}${draft.className ? ` for ${draft.className}` : ""}.${draft.extra ? ` Please include ${draft.extra}.` : ""}`;
    if (await bus("copilot.send", { text: ask }, 10000)) say('I\'ve asked Copilot. Tell me anything to add, or say "proceed" when you\'re happy.');
  }, [bus, navigate, say]);

  const perform = useCallback(async (c: Command, confirmed = false) => {
    if (needsConfirm(c) && !confirmed) { say(describe(c), { confirm: c }); return; }
    switch (c.kind) {
      case "navigate": say(`Opening ${c.label}.`); void navigate({ to: c.path as never }); return;
      case "open_class":
        if (pending.current?.slot === "class") { const d = { ...pending.current.draft, className: c.name }; pending.current = null; await createNote(d); return; }
        say(`Opening ${c.name}.`); void navigate({ to: `/class/${c.classId}` as never }); return;
      case "open_note": say(`Opening ${c.name}.`); void navigate({ to: `/lesson-notes/${c.noteId}` as never }); return;
      case "list_classes": say("Here are your classes."); void navigate({ to: "/teaching-hub" as never }); return;
      case "list_notes": case "list_games": say("Opening your list."); void navigate({ to: (c.kind === "list_notes" ? "/lesson-notes" : "/game") as never }); return;
      case "make_note": await createNote({ topic: c.topic, subtopic: c.subtopic, className: c.className, extra: c.extra }); return;
      case "copilot_say": await bus("copilot.send", { text: c.text }); return;
      case "proceed": await bus("copilot.proceed"); return;
      case "ai_edit": if (await bus("aiedit.open")) await bus("aiedit.run", { instruction: c.instruction }, 4000); return;
      case "floating_generate": await bus("floating.generate"); return;
      case "floating_delete": await bus("floating.delete", { n: c.n }); return;
      case "floating_move": await bus("floating.move", { from: c.from, to: c.to }); return;
      case "floating_merge": await bus("floating.merge", { numbers: c.numbers }); return;
      case "floating_together": await bus("floating.together", { a: c.a, b: c.b }); return;
      case "guide_start": await bus("guide.start"); return;
      case "guide_stop": await bus("guide.stop"); return;
      case "send_queue": { const q = readQueue(); say(q.length ? "These are waiting:" : "Nothing is waiting to send.", q.length ? { queued: q } : undefined); return; }
      case "snapshot": await action("workspace_snapshot"); return;
      case "create_class": await action("create_class", { name: c.name }, `Create class ${c.name}`); return;
      case "link_game": await action("link_game_to_class", { gameId: c.gameId, classId: c.classId }, `Add ${c.label}`); return;
      case "link_note": await action("link_lesson_note_to_class", { notebookId: c.noteId, classId: c.classId }, `Add ${c.label}`); return;
      case "archive_note": await action("archive_lesson_note", { notebookId: c.noteId, confirmed: true }, `Archive ${c.name}`); return;
      case "ask": say(c.question, { options: c.options }); return;
      case "help": say("I can create lesson notes with Copilot, pass your requests to Copilot and AI Edit, arrange Floating Numbers, guide a solution step by step, open pages and classes, and manage your classes."); return;
      case "unknown": say("Sorry, I didn't catch that. Try one of these:", { options: c.suggestions.map((s) => ({ kind: "help", _s: s }) as never) }); return;
    }
  }, [action, bus, createNote, navigate, say]);

  const submit = useCallback((text: string) => {
    const t = text.trim();
    if (!t) return;
    setLines((l) => [...l, { who: "you", text: t }]);
    setInput("");
    const p = pending.current;
    // "Done" / "I have opened it": carry on with the waiting request, once.
    const waitingFor = awaiting.current.peek();
    if (!p && waitingFor && isFollowUp(t)) {
      if (hasTutorAction(waitingFor.name)) {
        const w = awaiting.current.take()!;
        void callTutorAction(w.name, w.args).then((r) => { if (r.say) say(r.say); });
      } else {
        const view = screenSummary();
        say(view.page === "question" && !view.hasSolution
          ? "This question has no saved solution yet, so I can't guide it step by step."
          : "I still can't see it on screen. Open the question and I'll start by myself.");
      }
      inputRef.current?.focus();
      return;
    }
    if (p) {
      pending.current = null;
      if (p.slot === "subtopic") {
        const sub = /^(any|you choose|anything|your choice|pick one)/i.test(t) ? pickSubtopic(p.draft.topic) : t;
        void createNote({ ...p.draft, subtopic: sub });
      } else {
        const cls = findEntity(t, known.current.classes);
        void createNote({ ...p.draft, className: cls?.name ?? t });
      }
    } else if (typeof navigator !== "undefined" && navigator.onLine) {
      void (async () => {
        try {
          const r = await understand({ data: { text: t, here, known: known.current, screen: screenSummary(), history: lines.slice(-6).map((l) => ({ who: l.who, text: l.text })) } });
          if (r.ok && r.pick) {
            const u = toCommand(r.pick, known.current);
            if (u.noteId) lastNote.current = u.noteId;
            if (u.command) { if (u.reply && !needsConfirm(u.command)) say(u.reply); await perform(u.command); return; }
            if (u.reply) { say(u.reply); return; }
          }
        } catch { /* fall back to simple commands below */ }
        void perform(matchCommand(t, known.current));
      })();
    } else {
      void perform(matchCommand(t, known.current));
    }
    inputRef.current?.focus();
  }, [createNote, here, lines, perform, say, understand]);

  const listen = useCallback(() => {
    const W = window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any };
    const SR = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!SR) { say("Voice isn't available in this browser. Please type instead."); return; }
    const rec = new SR();
    rec.lang = "en-GB";
    rec.interimResults = false;
    rec.onresult = (e: any) => submit(String(e.results?.[0]?.[0]?.transcript ?? ""));
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    rec.start();
  }, [say, submit]);

  if (!ready || !session || !role || !STAFF_ROLES.includes(role)) return null;

  if (!open) {
    return (
      <Button type="button" size="icon" aria-label="Open MathGPL Tutor" onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-[60] size-12 rounded-full shadow-lg">
        <GraduationCap className="size-5" />
      </Button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex h-[70vh] max-h-[520px] w-[min(92vw,360px)] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <GraduationCap className="size-4 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">MathGPL Tutor</p>
          <p className="text-[11px] text-muted-foreground">Talking MathGPL — tiny credit use online, free offline</p>
        </div>
        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Toggle voice"
          onClick={() => { const n = !speak; setSpeak(n); localStorage.setItem(SPEAK_KEY, n ? "on" : "off"); if (!n) window.speechSynthesis?.cancel(); }}>
          {speak ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Close" onClick={() => setOpen(false)}>
          <X className="size-4" />
        </Button>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
        {lines.length === 0 && <p className="text-muted-foreground">Say or type what you want, e.g. "Create a lesson note on set notation" or "Delete floating number 5".</p>}
        {lines.map((l, i) => (
          <div key={i} className={l.who === "you" ? "ml-auto w-fit max-w-[85%] rounded-lg bg-primary px-3 py-1.5 text-primary-foreground" : "max-w-[90%]"}>
            <p>{l.text}</p>
            {l.confirm && (
              <div className="mt-1 flex gap-2">
                <Button size="sm" className="h-7" onClick={() => void perform(l.confirm!, true)}>Confirm</Button>
                <Button size="sm" variant="outline" className="h-7" onClick={() => say("Okay, cancelled.")}>Cancel</Button>
              </div>
            )}
            {l.queued && (
              <div className="mt-1 space-y-1">
                {l.queued.map((q) => (
                  <div key={q.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1">
                    <span className="min-w-0 flex-1 truncate text-xs">{q.label}</span>
                    <Button size="sm" className="h-6 px-2 text-xs" onClick={() => void sendQueued(q)}>Send</Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => { dequeue(q.id); say("Removed."); }}>Discard</Button>
                  </div>
                ))}
              </div>
            )}
            {l.options && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {l.options.map((o, j) => {
                  const s = (o as unknown as { _s?: string })._s;
                  return (
                    <Button key={j} size="sm" variant="outline" className="h-auto py-1 text-xs"
                      onClick={() => (s ? submit(s) : void perform(o))}>
                      {s ?? describe(o)}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      <form className="flex items-center gap-2 border-t border-border p-2" onSubmit={(e) => { e.preventDefault(); submit(input); }}>
        <Button type="button" variant={listening ? "default" : "outline"} size="icon" className="size-9 shrink-0" aria-label="Speak" onClick={listen}>
          <Mic className="size-4" />
        </Button>
        <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Tell me what to do…"
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <Button type="submit" size="icon" className="size-9 shrink-0" aria-label="Send"><Send className="size-4" /></Button>
      </form>
    </div>
  );
}
