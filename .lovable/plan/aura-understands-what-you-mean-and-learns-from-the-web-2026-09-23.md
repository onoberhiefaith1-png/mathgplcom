# Aura: understands what you mean, and learns from the web

Two separate pieces of work. Nothing about her voice, the mathematics rules, lesson notes, Smartboard, Floating Numbers or the Game changes.

## Part 1 — She hears meaning, not raw sound

### English is locked
- Her listening is told the spoken language is English, so it stops guessing at other languages.
- Any fragment that comes back as Chinese, Korean, Japanese or other non-Latin script while you are speaking English is treated as a mishearing, not as words: it is dropped from your turn instead of being shown or sent.
- She always replies in English unless you ask her in words to change language.

### Filler and false starts are cleaned before she reads it
Before your turn is sent, the words are tidied the way a person hears them:
- "um", "uh", "er", "you know", "like" as filler removed
- stutters and immediate repeats collapsed ("I want, I want you to" → "I want you to")
- abandoned half-phrases at the start of a turn dropped
- stray one- or two-letter noise fragments dropped

So "Um... I want... I want you to, you know, open the lesson note and, um, work on quadratic equations" reaches her as "I want you to open the lesson note and work on quadratic equations".

The five-line panel still shows what was heard and stays editable — the cleanup happens on the way to her, not on your screen, so you can always see and correct the original.

### She interprets, she does not transcribe
Her call briefing gains a short, firm rule: treat the incoming words as an imperfect microphone signal, reconstruct the intended instruction from the sentence, the current topic and the previous turns, and act on the meaning. When a word is clearly garbled but the intent is obvious from context, act on the intent. When the instruction is genuinely ambiguous, ask one short question instead of guessing — and never invent a task.

## Part 2 — A real explorer with web and tutorial knowledge

She already explores the platform on a mission with her own record of what she knows and does not know. This adds the outside world.

### Web research
She gains the ability to search the public web and read a public page, then keep what she learned as a proposed note for your approval. Used when she hits genuine uncertainty about a concept, a standard or a technique.

### YouTube tutorials
Give her a public tutorial link and she can:
1. fetch the video's title, description and captions/transcript
2. read the transcript into an ordered list of steps
3. compare those steps against the real MathGPL pages and controls she can see
4. try the workflow herself inside her own practice notebook
5. write down where the tutorial and the live system differ
6. propose the confirmed workflow as knowledge for you to approve

This is a real ingestion pass over the tutorial's words, not a box to paste a link into. If a video has no public captions, she says so plainly rather than pretending she watched it.

### Broader exploration
Her mission runs get the web and tutorial abilities too, so a mission like "understand how to create a high-quality mathematics lesson note" can consult a tutorial mid-run. Unanswered questions stay marked unresolved and she moves on; you can interrupt and redirect at any point.

### Boundaries kept
Writing still happens only inside her own practice notebooks during a study run, assigning still asks you first, and she never seeks passwords, credentials or private data — she uses the access you already gave her.

## Technical notes

- `src/components/agent/recognizeStream.ts` — send `language: "en"` with each slice; drop segments whose text is predominantly non-Latin script.
- New `src/lib/agent/speechIntent.ts` — pure `cleanSpokenText()` (filler list, repeat collapse, fragment drop, script filter) with unit tests; applied in `AuraProvider`'s call path to the turn text before `streamCallTurn`, never to the displayed transcript.
- `brain.server.ts` `CALL_INSTRUCTION` — add the interpretation-and-English block; `systemPrompt.ts` gains the same language rule for the typed path.
- New `src/lib/agent/research.server.ts` — `webSearch`, `readWebPage`, `readYouTubeTutorial` (oEmbed metadata + public timedtext captions, transcript normalised to steps); no key required beyond what the project already has, fetch only public URLs, strip scripts, cap payload size, and surface a plain message when captions are unavailable.
- `toolTypes.ts` + `tools.server.ts` — manifest entries `web_search`, `read_web_page`, `study_tutorial`; added to `CALL_TOOL_IDS`'s escalation set (not the small conversational set) and to `STUDY_TOOL_IDS` in `studyPolicy.ts` as read-only tools.
- Tests: `speechIntent` cleanup cases (filler, repeats, non-Latin fragments, untouched clean text), YouTube transcript parsing, and tool-manifest wiring. Then a real two-minute call on your phone.
