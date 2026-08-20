# Co-Pilot diagram quality, reliability, training, and subtopic cycles

## Goal

Make MathGPL Co-Pilot feel like a dependable professional mathematics editor: textbook-clean diagrams, no trapped or unclickable workspace, strong mathematical conversation and planning, and a clear next-subtopic workflow that restarts the established lesson-building cycle without erasing prior work.

## 1. Match Builder diagram typography

- Compare a Builder scene and a Co-Pilot scene at the final SVG renderer, including scene label sizes, inherited font styles, SVG scaling, and stored object metadata.
- Normalize all diagram text through one shared typography rule: dark readable ink, regular weight, no text stroke, and scale-aware sizing that does not become bold when the SVG is enlarged.
- Reduce Co-Pilot construction defaults where they exceed Builder defaults, while preserving the existing thin, scale-aware construction lines.
- Apply the rule to point names, measurements, angles, free labels, axis labels, and captions so every diagram remains editable and visually consistent.
- Do not change geometry, coordinates, question ownership, or the one-question/one-authoritative-diagram rule.

## 2. Remove the intermittent workspace lock

- Trace the request that is active when the workspace stops accepting clicks, including Co-Pilot planning calls, Math Engine generation/verification retries, editor bridge calls, modal/backdrop layers, and busy-state cleanup.
- Give every Co-Pilot operation one lifecycle: `Thinking → Generating → Validating → Ready`, with a terminal `Stopped` or `Failed` state.
- Propagate the same cancellation signal through the Co-Pilot request, Math Engine attempts, ordinary lesson generation, and the sequential Question → Diagram → Solution build. Cancellation will stop at the next safe boundary without discarding completed content.
- Prevent overlapping sends, approvals, revisions, and build runs with one request/run lock rather than separate UI-only guards.
- Put cleanup in a guaranteed final path so busy state, overlays, and click interception are released after success, error, timeout, cancellation, panel close, and note change.
- Keep the lesson editor interactive during AI work. Only the initiating Co-Pilot controls are disabled; no page-wide blocker will cover the note.
- Persist completed and partial build state so refresh resumes at the correct queue item instead of appearing frozen or restarting.

## 3. Create a full Co-Pilot professional training standard

Add a dedicated Co-Pilot training/reference document and inject its distilled rules into every Co-Pilot stage. It will define:

- **Identity:** a professional secondary-school mathematics editor, lesson architect, and articulate teaching colleague—not a generic chatbot and not the producer of unverified mathematics.
- **Language:** precise mathematical vocabulary, concise natural conversation, confident but non-repetitive teacher voice, age-appropriate terminology, and clear acknowledgement of ambiguity.
- **Lesson intelligence:** infer progression from topic, active subtopic, curriculum level, existing note, approved blueprint, and completed items; avoid repetition and number-only variations.
- **Planning:** make explanations establish the method, examples demonstrate it progressively, and classwork/exercises/assignments use only methods already taught.
- **Mathematical boundaries:** Co-Pilot plans and supervises; the MathGPL Math Engine produces and verifies teacher-facing mathematics. Failed verification must be revised or surfaced, never silently accepted.
- **Diagrams:** request structured 2D constructions only when mathematically useful; specify required points, relations, labels, marks, and intended teaching purpose; never request generic image generation.
- **Editing intent:** distinguish number/quantity changes from mathematical-content changes, resolve references against the live note, ask once when genuinely ambiguous, and edit only the named item.
- **Conversation:** understand “proceed”, “carry on”, “make Example 2 harder”, “change the numbers”, and follow-up references from conversation and cursor context.
- **Quality checks:** before proposing or building, check correctness, solvability, progression, vocabulary, notation, duplication, solution availability, diagram necessity, and alignment with the approved blueprint.
- **Output contracts:** stage-specific structured responses, no raw code/LaTeX leakage, no invented editor actions, and no mutation during planning/blueprint review.

The existing Master Pedagogical Reference remains authoritative for solution pacing and notation. Contradictory notation guidance in that reference will be reconciled so the model receives one unambiguous rendering rule.

## 4. Add the completed-lesson Subtopic action

- When the current build queue is complete, show a clear `New subtopic` action in the Co-Pilot panel beside the option to continue editing the completed subtopic.
- Clicking it opens a focused subtopic-title field. Confirming the title inserts/activates the real level-one subtopic heading in the lesson note, updates the Co-Pilot’s persistent subtopic/cycle, and keeps all previous note content and conversation.
- Start the established procedure again for the new subtopic at the editable structure counts: Introduction, Explanation, Example, Classwork, Exercise, Assignment, Conclusion. Zero continues to mean skip.
- Free-text messages after completion remain editing instructions for the previous/current content unless the teacher explicitly chooses `New subtopic`; do not guess that an ordinary message starts a new cycle.
- Resuming after refresh restores the active subtopic, structure, blueprint, queue, and conversation for the correct cycle.

## Technical scope

- Shared diagram renderer and construction label defaults.
- Co-Pilot conversation/run controller, Math Engine request client, lesson-generation bridge, and panel lifecycle UI.
- Co-Pilot backend prompt composition plus a dedicated professional training reference.
- Existing persistent Co-Pilot session/message records and existing lesson-note subtopic insertion/context APIs.
- No changes to the fixed Co-Pilot procedure, mathematical verification ownership, geometry construction mathematics, account roles, credits, or unrelated lesson-note controls.

## Verification

- Generate equivalent 2D diagrams through Builder and Co-Pilot; compare every text category at normal and enlarged sizes and confirm regular-weight black labels with examination-style lines.
- Start and cancel during Thinking, Generating, diagram construction, validation, and solution generation; confirm the editor remains clickable, no late response mutates the note, and the correct partial queue survives refresh.
- Attempt duplicate sends/approvals and confirm only one request and one build item run.
- Exercise the trained Co-Pilot with progression, ambiguity, edit-intent, vocabulary, diagram-necessity, and “proceed” scenarios; confirm the Math Engine remains the sole mathematics producer.
- Complete one subtopic, create a second from the new action, edit the first through free text, refresh, and verify both content cycles and their active state restore correctly.
