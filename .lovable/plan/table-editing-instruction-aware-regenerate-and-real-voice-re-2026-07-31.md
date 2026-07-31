# Table editing, instruction-aware Regenerate, and real voice recording

Three separate fixes.

## 1. Smart Table — insert rows/columns anywhere, and swap them

Today the table only supports "number of rows / number of columns" steppers in the Properties Panel, which append a blank row or column at the end. There is no way to insert a column *after X* inside an existing table, and no way to reorder.

New behaviour:

- **Line selection.** Clicking a row header strip (left edge) selects the whole row; clicking a column header selects the whole column. The selected line is highlighted end-to-end. Esc or clicking elsewhere clears it.
- **Insert relative to the selection.** With a line selected, the Properties Panel shows: Insert row above / Insert row below / Insert column left / Insert column right / Delete line / Duplicate line. The new row or column is inserted *inside* the grid at that index, shifting the rest — not appended at the end.
- **Swap / move.** Move up / Move down for rows, Move left / Move right for columns, so a whole row or column (including its header) can be reordered. Rows and columns can also be swapped by selecting one and using the move controls repeatedly.
- The existing stepper controls, cell calculator, Σ summation, and AI Edit on a cell stay exactly as they are.

## 2. Regenerate must read the teacher's latest instruction

Confirmed cause: in `SectionHeading.tsx` the Regenerate footer action is wired as `run("regenerate", "")` — it discards whatever is typed in the AI popover box, so "add a column for me" never reaches the model. The same applies to Paraphrase, Extend and Clear, and to the attached images.

Fix:

- Footer actions receive the popover's current prompt text **and** the attached images, so Regenerate = "regenerate this section, applying this instruction".
- The popover keeps the typed/spoken instruction visible while the action runs, and clears it only after success.
- In the AI Edit panel's simple mode, the preview stage gets a small instruction box next to Regenerate, so a second pass can be steered instead of repeating the identical prompt.
- The regenerate request payload carries the instruction, any attached image, and the existing section content as context, so the model edits rather than starting blind.

## 3. Voice recording — continuous, additive, no duplication

Current dictation uses the browser `SpeechRecognition` engine, which stops on silence, restarts unpredictably, and duplicates phrases when the engine re-emits results. It is replaced with a real recorder, matching the behaviour the user expects:

- **Press to start, press to stop.** Recording continues while the button is on, no matter how long the pauses are. Nothing ends it except the second click.
- **Live waveform.** An animated audio-level waveform is shown while recording, driven by the actual microphone level, plus an elapsed timer.
- **Confirm to insert.** Stopping shows the transcript; it is appended to whatever is already in the box, never replacing it. Recording again continues from the existing text.
- **No repeats.** Because the transcript comes from one buffered pass over the recorded audio rather than incremental interim guesses, "write this board" can no longer be emitted twice.

Applies everywhere the mic appears: the section AI popover, the AI Edit panel, and the floating-numbers Assistant panel.

## Technical notes

- Table: extend `SmartTable.tsx` with `insertRowAt / insertColAt / moveRow / moveCol / duplicateLine` operating on `cells`, `headers` and `colWidths` together; add `selectedLine` state (`{kind: 'row'|'col', index}`) rendered as a highlight overlay and surfaced through `useRegisterAssetEditor` per the right-hand-panel-only rule.
- Regenerate: change `AiFooterAction.onRun` to `onRun(prompt, opts)` in `AiPopover.tsx`; update `SectionHeading.tsx` call sites to forward the prompt and images into `run(action, prompt, opts)`; `DocumentEditor.tsx` already threads a prompt into the regenerate branch.
- Voice: rewrite `useVoiceInput.ts` around Web Audio PCM capture + WAV encoding, chunked into self-contained segments while recording, posted to the existing `speech-transcribe` function (`openai/gpt-4o-mini-transcribe`); expose `{ listening, level, seconds, start, stop, reset }` so panels can render the waveform. Guard near-empty clips with a re-record prompt.
