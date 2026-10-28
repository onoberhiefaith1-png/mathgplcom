# Two fixes: Vault must never award the line mark, and text must stay fast inside a room

## 1. Vault activation vs line mark

### What the inspection shows

- The Vault opens from live working only, by exact ordered token matching (`vaultMatches` in `src/lib/slate/lineSurfaces.ts`): `x + 1` opens, `1 + x` does not.
- The line mark comes from a different source: the Smartboard's authoritative `lastAwardedLineId` (`useGameRuntime.ts`), which is the only place that adds to completed lines, completion count and earned marks.
- Notes are gated on `awarded` (completed lines), not on rewards.

So the two conditions are already separate in code. What is missing is a hard guarantee and proof, so a Vault can never start drifting back into the mark path.

### What will change

- Add an explicit one-way rule in the runtime: opening a Vault may only change the vault reward total, the opened-vault count and that Vault's own consumed key. It can never touch completed lines, completed line keys, completion count, earned marks, or the saved question result.
- Keep note reveal strictly behind: line completed → mathematical equivalence verified by the grader → mark awarded → note appears. A Vault opening leaves the note hidden.
- Keep Vault reveal effects independent of line completion, so a Vault can open on an unfinished line, and a line can be marked with no Vault opened.
- Add regression tests: exact-sequence-only opening (`x + 1` yes, `1 + x` no); Vault opening awards no marks and reveals no note; an equivalent rearrangement still earns the line mark with no Vault opening; one-time Vault, unchanged by reset of teacher design.

## 2. Text is slow once a room is enabled

### Why it is slow

With a room enabled the same frame budget that serves writing also carries:

- continuous per-frame room animation loops (flame shaders, floating particles, environment motion) that run every frame whether or not the student is writing;
- an HDRI environment plus room fog and many additional room meshes and materials, raising draw calls and shader work;
- the whole room subtree sitting in the same React tree as the writing surfaces, so state that belongs to writing can cause room work to be re-evaluated.

### What will change

- Treat the room strictly as a background/environment layer: the room subtree becomes a self-contained, memoised scene keyed only by the room id, receiving nothing that changes while a student writes. Writing state changes can no longer reach it.
- Put the room's per-frame animation on a small, capped budget and idle it while the student is actively entering mathematics, resuming shortly after. No visual element is removed.
- Replace the expensive room environment lighting with the equivalent cheap static lighting already used for the writing scene, keeping each room's look and grade.
- Guarantee writing text and tiles are never rebuilt because the room changed: text geometry, wrapping and measurement stay keyed to the line and its teacher settings only.
- Keep pointer handling owned by the writing surfaces: the room contributes no hit targets and cannot delay or swallow a tap.

## Technical notes

- `src/hooks/useGameRuntime.ts`: the Vault branch of line-reward resolution and the live Vault effect write only vault state; the awarded-line branch stays the single writer of marks.
- `src/lib/slate/lineSurfaces.ts`: `gameLineDisplayText` note gating unchanged; `vaultMatches` unchanged.
- `src/components/gameslate/world/RoomShell.tsx`: memoised shell, capped animation budget with an idle-while-writing gate, static lights, raycast still disabled.
- `src/components/gameslate/world/WorldStage.tsx`: room environment/HDRI replaced by static lighting in room mode; room subtree isolated from writing state.
- Tests: extend `src/lib/slate/__tests__/lineSurfaces.test.ts` and the runtime suite; run the focused Slate/room suites and a type check.

## Verification

1. Room = None: confirm current fast entry and selection.
2. Room enabled: confirm tapping and writing respond just as fast, with the room unchanged visually.
3. Open a Vault with the exact sequence on an unfinished line: it reveals, no mark, no note.
4. Complete the line with an equivalent correct form: mark awarded, note appears, no Vault opened by that alone.
