# Upgrade the MathGPL ChatGPT connection: precise highlighting, own Floating Numbers, full validation

Upgrade the existing connection only. No new plugin, no new server, no change to the lesson-note screens or the database layout.

## What changes for the teacher / ChatGPT

1. **set_solution_highlights** — ChatGPT can highlight a whole solution line or only part of one (e.g. just one equation from a line). Each selection becomes a numbered line L1, L2, L3. Everything not highlighted stays exactly as written and remains as Notes.
2. **generate_solution_floating_numbers** — ChatGPT supplies its own token groups for each numbered line (a whole line as one token, single symbols, or grouped words/symbols). Saved only if the tokens joined in order reproduce the highlighted text exactly. Uses no MathGPL credits (no MathGPL AI is called). The existing credit-using `generate_floating` stays available.
3. **validate_lesson_floating_numbers** — one read-back per lesson: for every question returns the question, full solution, numbered highlighted lines, Notes, saved tokens, whether each line reconstructs exactly, whether the question sits in the right session, and whether the Smartboard can load it. Flags missing lines, duplicates, bad grouping, broken formatting (fractions, roots, powers) and mismatches.
4. Operating Guide updated to describe the full sequence: create note → sessions → questions → solutions → highlights → tokens → validate. Guide version bumped so ChatGPT reloads it.
5. Smartboard click-simulation stays a later phase; `smartboard_test` unchanged. Smartboard Next behaviour is untouched.

## Safety

- Every tool uses the existing verified teacher identity and only touches that teacher's own notes.
- Highlights and tokens for a question are replaced only for the named session; no notes or sessions are deleted. Repeating the same call gives the same result (no duplicates).
- Replacing existing Floating Numbers on a question that already has them requires `confirmed: true`.
- Clear structured errors with stable IDs.

## Testing

- Automated tests: whole-line and partial-line selections, Notes preserved, ordering, exact reconstruction (pass and fail cases incl. fractions/roots/powers), ownership refusal for another teacher's session, confirmation required on overwrite, validation reporting each fault type.
- Tool list regenerated (63 → 66 tools) and checked.
- A real temporary quadratic lesson run end-to-end in ChatGPT needs you after publishing (and possibly a reconnect so ChatGPT sees the new tools). I will not create test notes in your account myself.

## Technical details

- Storage reuses `notebook_subsections.floating_highlights` (`{uid, groupId, tokens:[{line,tok}], payload}`) and `floating_lines` (`{fillers, arrangement, ...}`). Partial selections are expressed as `{ solutionLine, start, end }` character offsets (1-based line within the solution blocks); mapped to the `tokenizeMath` token indices the editor already uses, rejecting offsets that cut through a token so the Floating Prep page renders them identically. `payload` = exact selected substring.
- Reconstruction check: normalise whitespace only, compare `fillers.join` with `payload`; reject otherwise. Lines keyed by highlight `uid`/L-number.
- Pure helpers in `src/lib/mcp/floatingPrep.ts` (selection→highlight, reconstruction, validation) with vitest tests; tools in `src/lib/mcp/tools/` registered in `src/lib/mcp/index.ts`, owner checks via existing `requireUser` + notebook ownership chain.
- `GUIDE_VERSION` bump in `operatingGuide.ts`; update `docs/chatgpt/capability-map.md`.
- No migration, no deployment.
