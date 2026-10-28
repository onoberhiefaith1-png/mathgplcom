## Build steps
1. **Command catalogue**: one list of every action Aura can run today (workspace snapshot, list/create classes, list students, list/create/read/archive lesson notes, add session, write question, link note or game to class, list games, remove student, explain workflow, navigate). Each entry gets example phrases, the details it needs (e.g. class name) and whether it needs a Confirm.
2. **On-device matcher**: understands everyday phrasing, plurals and small spelling mistakes, and fills in names from your real classes, notes and games (fuzzy matching). Asks a short follow-up when a detail is missing ("Which class?").
3. **Free voice**: listening with the browser's built-in speech-to-text where available (Chrome, Edge, Safari) with typing always available; speaking with the device voice. A "Speak replies" switch.
4. **Runner**: runs the chosen action through the same checked server actions Aura uses, as the signed-in teacher, with Confirm for changes and deletions.
5. **Offline**: navigation, help and reading notes work offline; saving actions queue and send when back online.
6. **Optional tiny AI fallback** (off by default; you decide): smallest model, command-picking only, short prompt, daily cap, metered in the usage ledger like everything else.
7. **Lesson notes**: "make a note on…" opens the Copilot with the topic filled in, so it costs what a normal note costs.

## Questions for you after approval (can default)
- Default: tiny AI fallback **off**. You can switch it on later.
- Default: teachers only (school owners included), not students.

## Technical details
- New pure module `src/lib/assistant/` (catalogue, normaliser, fuzzy matcher, slot filler) with unit tests per command: no network, no model.
- Reuse `TOOLS` in `src/lib/agent/tools.server.ts` via one authenticated `createServerFn` runner with an allow-list; nothing in Aura's files is modified, and Aura stays admin-gated.
- Voice: `webkitSpeechRecognition`/`SpeechRecognition` + `speechSynthesis`; feature-detected, falls back to text.
- Offline queue in IndexedDB, flushed on `online` event; navigation via TanStack `navigate`.
- Fallback (if enabled): `google/gemini-2.5-flash-lite`, structured output picking a command id + slots, metered with `recordUsage`, server-side per-user daily cap.
- AGENTS.md rule: the assistant runs only catalogued actions picked on the device; AI may only choose a command, never run free-form work.