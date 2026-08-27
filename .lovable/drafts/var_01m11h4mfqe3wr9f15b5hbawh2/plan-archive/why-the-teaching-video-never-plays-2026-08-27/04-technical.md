## Technical notes

**`src/lib/courses/questionVideo.ts` — `sectionsFor`.** The explicit-marker branch returns without advancing `prev`, so every following section chains from a stale cursor. Fix: in both branches set `prev = end` after pushing. Additionally, in the marker branch derive `start` as `mStart ?? prev` **and** fall back to `prev` whenever the written `start` is not less than the written `end` (the collapsed case) — the repair is in the pure model, so player, editor and student side all get it. `end` clamps to `[start, duration]` as now, and if `end <= start` the section runs to the next written boundary (or `duration` for the last).

**`src/components/coursebuilder/QuestionVideoEditor.tsx`.** The `setField` helper (line ~91) currently mutates both edges: `end` does `start: Math.min(m.start, value)`. Replace with end-only editing — the start cell becomes a read-only derived value from `sectionsFor`, `markersFor` still persists both edges so the stored shape is unchanged. Extend the existing `overlapsFor` warning row to also list zero-duration keys, and block Save with a message naming them.

**`src/components/smartboard/QuestionVideoPane.tsx`.** `onTimeUpdate` stops at `active.end - EPS`; with a repaired model this is already correct. Add one guard: skip the boundary stop when `active.end - active.start <= EPS`, so a bad record degrades to continuous play rather than a frozen frame. The clock/progress line uses the same guard.

**Tests** in `src/lib/courses/__tests__/`: `prev` chaining across a mix of marked and unmarked sections; a collapsed marker repaired to the previous end; the existing saved record (the five markers above) producing five non-empty ordered slices; editor end-only edit never producing `start === end`.

**Real-time check** with Playwright on `localhost:8080`, student exercise board for block `b495f550…`, question `f2039634…`: assert `video.currentTime` advances past 1 s, that it pauses within 0.2 s of 17.63, and that the same element keeps its `currentTime` after switching Smartboard → Split → Video.
