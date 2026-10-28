## Part 1 — the lesson-note training

**The model note.** One worked lesson note is written into Aura's knowledge exactly as it
appears on the page: Introduction, Explanation, Example 1 with its Question and its Solution,
Example 2, Classwork, Assignment. Plain lines only. No line numbers, no internal words, no
"Problem:" label. She is shown this first, as the thing to copy, before any explanation.

**How the Solution heading reads.** The bold word is Solution. Beside it sit two small quiet
links: Floating Number, which leads to the highlighting page and then the generating page, and
Assign, which hands the question, its solution and its chips to a class. They are never bold
headings, never section titles, never text she types into the body.

**The two pages behind Floating Number,** described as they look: the highlighting page shows
only the written solution and you drag across the steps that should become movable pieces; the
generating page turns each highlight into a line of pieces, and the one real choice is whether
they start in solution order or shuffled.

**Everything along the top of the page,** each with what it is for and when a teacher reaches
for it: Section and Add Session, Add Subtopic, Asset Library, Diagram with its 2D and 3D modes,
Smart Table, Maths Table, Graph, Calc, Conversion, insert-maths structures, the AI button,
Symbols, Matrix, Slides, Emoji, paper size and style, zoom, Note Extend and Note Shrink, Export
as Word or PDF, Scan from phone, and Present on Smartboard. Plus the `@` picker and its named
assets — shapes, number line, compass, protractor, ruler, Venn diagram, charts, coordinate grid,
manipulatives and measurement objects.

**Emojis** get their own explanation: they are used sparingly, to mark a caution, a rule worth
remembering or a friendly aside for younger classes — never decoration sprinkled through the
mathematics, and never inside a solution line, because the board reads that line as maths.

This lands as expanded knowledge nodes plus the operating rules Aura carries on every turn, with
a short "what a finished note looks like" example she can always compare her own work against.

## Part 2 — self-study

**The button.** On the existing training page, administrator only: name a feature, press start.
A study run opens with that feature as its subject.

**Live commentary.** Today a turn reports only when it finishes. The run becomes a streaming
turn: each thought, each action and each result is pushed into the Aura panel the moment it
happens, so you watch her work. Your correction can be typed at any point and is folded into the
run straight away.

**Working alone.** Once started, a run keeps choosing its own next thing to try inside the named
feature: pick a topic, write a question, decide a diagram is needed, look at which diagrams
exist, try one, generate Floating Numbers from a solution, open a dry run, notice what does not
work. When it runs out of ideas in one feature it reports and waits for the next subject rather
than wandering into unrelated parts of the platform. Each run continues in the background while
the panel is open, and a run can be paused or ended by you at any time.

**Where it writes.** Everything she creates while studying goes into practice notebooks marked
as hers. Your real notes and classes are read only. Nothing is assigned, published, shared or
deleted during a study run, and nothing goes to a student.

**Findings.** Each run ends with what she believes she learned, split into what she actually
observed and what she assumed. These arrive on the training page as proposals; only your approval
turns one into a rule she uses afterwards. A thing that looked broken is logged as a problem,
never as the correct way to work.

## Technical notes

- Knowledge: expand `src/lib/agent/knowledge/lessonNotes.ts` and add a toolbar/asset node set
  built from the real registry names in `src/lib/lessonnotes/assets/registry.ts`; add the model
  note and the Solution/Floating/Assign wording to `src/lib/agent/systemPrompt.ts`.
- Streaming: add a streaming counterpart to `agentChat` (the current `createServerFn` returns
  the whole turn), emitting step and reasoning events as they occur, consumed by
  `AuraProvider.tsx` / `AuraCockpit.tsx` so `AuraStepCard` renders live.
- Study loop: a new `study.server.ts` driving bounded iterations against a sandbox scope, using
  the existing tools with writes forced onto practice notebooks, plus `propose_knowledge` for
  findings; a staged additive migration for study runs and their transcripts.
- Training page: subject input, start/pause/end, run history and findings review beside the
  existing approval cards in `src/pages/admin/AdminAuraTraining.tsx`.
- Untouched: the maths engine, pedagogy rules, Floating Numbers generation itself, the
  Smartboard, the Game, and the assistant's model.
