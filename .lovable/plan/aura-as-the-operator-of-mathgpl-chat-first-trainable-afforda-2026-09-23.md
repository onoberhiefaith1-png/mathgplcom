# Aura as the operator of MathGPL — chat-first, trainable, affordable

Goal: a teacher opens MathGPL, talks to Aura, and the work gets done — the same feeling as talking to Lovable. No hunting through pages first. Aura only asks for help when something is genuinely ambiguous.

## 1. Cost first (this is built before anything else)

- Aura's everyday brain becomes a small, fast model, with no hidden reasoning tokens. Heavy work (a full lesson note, mathematics checking) is handed to the existing trained generator, not re-invented per turn.
- A per-account daily spend ceiling with a visible remaining figure. When it is reached, Aura keeps talking but stops autonomous work until the next day.
- Every turn records what it cost. A teacher-only line shows today's total in pence, so the £20/month target is provable, not assumed.

## 2. Aura becomes the front door

- A chat workspace page is the first thing a signed-in teacher sees: one message box, the conversation, and cards showing each step as it happens ("opened the note", "wrote section 2", "tested on the Smartboard").
- Every card links straight into the real page (lesson note, Smartboard, class, game) so the teacher can walk in and check the work. The rotating building and all existing pages stay exactly as they are and stay reachable.
- Voice stays as it is today — same voice, same call button, same input bar and attachment button.

## 3. She produces a clean lesson note, every time

The current failure (solutions written as one long line, equations split, Floating Numbers misunderstood) is fixed by removing the freedom to improvise:

- A note is built through a fixed contract: note -> session -> question -> solution written one micro-step per line -> highlight the lines -> generate Floating Numbers from those highlighted lines -> test on the Smartboard -> assign.
- Every question lands in a real session, so Smartboard navigation works.
- The written solution is checked before it is saved: one step per line, no skipped transitions, the question restated word for word. A note that fails the check is rewritten, never half-saved.
- "Floating Numbers" means chips taken from highlighted solution lines — she never re-writes or re-splits the equation to make them.

## 4. Train mode — you show, she does, you correct, she keeps it

- A training conversation where you name a task, she performs it on screen, and you say what was wrong. Your correction is saved as a rule with the exact page and control it applies to.
- Approved rules are given to her on every turn afterwards, and they outrank her own guesses.
- She practises in her own workspace: her own notebooks and classes, so nothing of yours is touched while she learns. When she finishes she says what she made and where to look at it.
- She can run a training goal on her own ("learn how to make a good quadratics note"), reporting what she confirmed and what she is still unsure about, and continuing past an unanswered question instead of freezing.
- End users get none of this — they get the trained result.

## 5. What she can do on request

Existing abilities, driven from chat: open and write lesson notes, sessions and questions, highlight and generate Floating Numbers, test on the Smartboard, create classes and students, assign work, set up games and Adventures from existing structures. Anything that affects students (assigning, publishing) still asks you first. Anything she cannot actually do, she says so plainly instead of claiming it.

## 6. Proof before this is called done

One scripted run, reported with real numbers, not estimates:

1. "Generate a lesson note on quadratic equations and assign it to my class."
2. The resulting note is opened and checked line by line against the standard.
3. The Floating Numbers are opened on the Smartboard.
4. The measured credit cost of the whole run, and the projected monthly cost for a heavy teacher.

If the cheap brain cannot pass step 2, that is reported as a number and a fact, and we decide together whether note writing alone moves up a tier.

## Technical notes

- `brain.server.ts`: `AGENT_MODEL` moves to the cheapest model that passes the lesson-note contract; drop `forceReasoning`/`reasoningEffort`/reasoning includes on conversational turns; keep the two-tier tool manifest (small set for talk, full set on real work) and the per-call cached system briefing.
- Note writing stays routed through the Co-Pilot generator in `lessonKnowledge.ts` / `hands.server.ts`; add a post-generation validator (one step per line, question restated verbatim, no equation splitting) that rejects and retries rather than saving.
- New chat workspace route rendering the existing `AuraProvider` conversation plus step cards; existing routes untouched.
- Training: extend `aura_knowledge` (proposed/observed/approved/retired) with the page and control a rule applies to; `aura_missions` already records exploration runs; `/admin/aura-training` gains the show-and-correct loop.
- Spend guard: per-user daily credit ledger checked in `usageLimits.ts` before any model call; autonomous runs stop at the ceiling, conversation does not.
- Unchanged: her voice and the speech pipeline, the mathematics rules, QUESTION_LOCK, Smartboard, Floating Numbers, the Game and saved teacher designs.
