## What "Proceed anyway" does on the final render

The overflowing speech is left to **run over**: the mix is assembled with every word at full length, so a long segment spills past the end of its original clip and may overlap the speech after it. Nothing is trimmed, nothing is sped up. The rendered video and the saved language version are labelled as containing accepted overflow, so it is clear later how the file was produced.

## Where the warnings appear

| Stage | Warning | Proceed anyway means |
| --- | --- | --- |
| 1 Edit | No clips on the timeline | Use the video exactly as uploaded |
| 2 Audio | Audio not extracted | Continue without extracted audio |
| 3 Transcript | Nothing transcribed | Continue with what exists |
| 4 Paraphrase | Segments failed or out of date | Accept the current wording |
| 5 Language | Segments not translated | Continue with untranslated lines |
| 6 Voice | Segments missing a voice, or made with a different voice | Accept the gaps / mixed voices |
| 7 Timing | Segments longer than their clip | Accept the overflow |
| 8 Subtitles | Captions missing or failed | Accept the captions as they are |
| 9 Final preview | Overflow, mixed voices, missing clips | Build and render anyway |
| 10 Publish | Track or video not rendered | Finish anyway |

A genuinely fatal case — the source video file is no longer held by this browser — is stated in the same panel, and Proceed anyway explains that the file must be re-attached first rather than pretending to continue.

## Technical notes

- One checks list per stage in `src/lib/editor/useWorkflow.ts` (a `blockers` derivation returning `{ stage, code, message, segmentIds }`), replacing the ad-hoc `toast.error` guards inside `buildTrack`, `renderVideo`, `runVoice` and the approve path. Guards and panel then read the same source and can never disagree.
- Overrides stored per stage and check code in project state (`state.overrides`), saved with the project so they survive reload; editing content that feeds a check clears its override.
- `StagePanel` gains a blockers region above the footer with the Proceed anyway action; `WorkflowStages` passes each stage's list. `canApprove` becomes `no blockers || overridden`, so no button is disabled without a reason on screen.
- Overflow override path: `buildTrack` places overridden segments with no `containerEnd`, so `buildGeneratedTrack` in `src/lib/editor/voice.ts` writes the whole clip instead of clamping at the clip edge, and the total track length grows to cover the longest spill.
- `GeneratedVideoMeta` and the saved version record gain an overrides summary for the labelling above.
- Entirely browser-side: no database, storage or backend changes.
