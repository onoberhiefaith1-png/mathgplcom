# Keep every Solution assigned, prepared, and saved

## Confirmed problem
- In the current lesson note, only the first Example has saved Floating Numbers. Later rows have no Floating Numbers, and their worked answers have been folded into the Problem while the saved Solution is empty.
- AI Edit inserts the lesson text into the document, but its accept path does not prepare each resulting Solution through the existing Floating Numbers workflow.
- The manual **Session** action converts the selected content into another session heading. It is not an “attach this existing Solution” action, so using it on an existing Solution can duplicate the structure.
- Automatic document saves rebuild the Smartboard rows. Matching relies heavily on a changing document key; an unmatched prepared row can therefore be replaced by a blank row.

## Changes
1. **AI Edit creates complete Problem → Solution pairs**
   - Normalize accepted AI Edit output into one question with one owned Solution directly beneath it.
   - Preserve the original question, method, numbers, sequence, diagrams, and solution text.
   - Give each pair a durable identity before saving so the Solution is never interpreted as an independent section.

2. **Automatically prepare every generated Solution**
   - After AI Edit is accepted, sync the finished document first, then run the existing Floating Numbers generator for every new or changed Solution.
   - Attach the generated Floating Numbers to that exact question row rather than creating a second Example/session.
   - Keep the Solution’s **Floating** and **Assign** controls available from its heading after reload. If automatic preparation fails, leave the Solution intact and allow the teacher to prepare it manually.

3. **Manual preparation remains permanent**
   - Match saved question rows by durable question identity first, then exact normalized Problem and Solution content.
   - Carry all prepared state—Floating Numbers, bucket, highlights, scoring, and stable assignment identity—onto the matching row before any obsolete row is removed.
   - Block synchronization from replacing a prepared row with an empty row for a question that still exists.
   - Make opening Floating Numbers update the existing question row only; it must never duplicate the Solution or create another lesson session.

4. **Real Save button at the top**
   - Add **Save** beside **Select Flow** and **Present**.
   - Clicking it cancels the pending delay, saves the latest visible lesson, completes the Smartboard-row sync, and reports **Saving…**, **Saved**, or an actionable failure.
   - Present and leaving the note will flush pending changes first so a recently prepared Solution cannot be lost.

5. **Use the same behavior in AI Edit and Co-Pilot**
   - Route both through the same Problem/Solution pairing, preparation, and persistence path.
   - Do not maintain separate rules that can drift.

## Verification
- AI Edit a lesson containing several Examples/Classworks; each gets exactly one owned Solution, one Floating control, and one Assign control.
- Confirm every generated Solution receives saved Floating Numbers without clicking Session.
- Manually prepare a Solution that missed automatic preparation, save, leave the note, return, and confirm the preparation is unchanged.
- Edit or reorder nearby content, save again, and confirm the same prepared question row and assignments remain.
- Confirm clicking Session on already structured Solution content does not duplicate it.
- Confirm the Save button persists the latest visible content and preparation before Present/navigation.
- Add regression tests for AI Edit pairing, per-Solution automatic preparation, prepared-row conservation, no duplication, forced save, and reload.

Previously lost preparation cannot be reconstructed exactly unless an existing saved row still contains it; blank Solutions will be regenerated from their preserved questions where safe.
