# Smartboard line progress colour settings

## Goal
Make the existing Student Smartboard line-progress colours teacher-configurable without redesigning its navigation, timer, assessment, reset, or layout behavior.

Defaults remain:
- **Permanent Achievement Colour:** Blue
- **Current Timed/Repeat Attempt Colour:** Brown

Brown appears only while the timer attempt layer is active. Without a timer, completed lines use only the permanent achievement colour.

## Verified foundation
- Permanent line achievement is already stored separately in `assessment_progress.solved_lines`, with marks keyed by question and line.
- Timed/repeat progress is already stored separately in `assessment_timer_attempts.attempt_lines`.
- Reset already clears board work and starts a fresh timer attempt without clearing permanent marks.
- The shared top progress strip already gives the timed attempt visual precedence over permanent achievement while retaining the permanent state underneath.
- The remaining gap is that its blue derives from the board accent and its brown is hard-coded, while the existing Board Settings colour controls do not configure these two states.

## Implementation

### 1. Add durable teacher colour settings
- Add two validated colour fields to each assessment:
  - permanent achievement colour
  - current timed/repeat attempt colour
- Give existing and new assessments the fixed blue and brown defaults.
- Store colours independently from `solved_lines`, scores, and timer attempts, so changing a colour never changes achievement or marks.
- Reuse existing class ownership and membership permissions: teachers can update their assessment settings; students can only read them.

### 2. Extend Smartboard Settings → Colour
- Add labelled selectors using the exact names:
  - **Permanent Achievement Colour**
  - **Current Timed/Repeat Attempt Colour**
- Use unrestricted valid colour inputs rather than a fixed palette.
- Permit identical values for both selectors.
- Show these controls only where an authorised teacher can change the assessment; student and guest boards consume the saved values without gaining edit permission.
- Keep Ink Colour and Placeholder Colour independent from these progress colours.

### 3. Connect settings to the real progress indicator
- Replace the hard-coded brown and accent-derived blue in the existing top line/question progress strip with the saved settings.
- Preserve the existing three-position moving window across the full guided-line sequence.
- Apply the same resolved colours anywhere this shared indicator is rendered, including desktop, phone, tablet, teacher review, student assignment, and guest views that receive assessment settings.
- Keep neutral, active-navigation, wrong-answer, timer, and score visuals separate from these two progress colours.

### 4. Enforce the exact two-layer behavior
- **Timer off:** only permanent achievements are coloured; the current-attempt colour is never rendered.
- **Timer on:** confirmed lines in the current timed attempt render with the current-attempt colour above any permanent achievement.
- **Reset timed attempt:** clear only temporary attempt markers, revealing retained permanent achievements underneath.
- Newly solved lines during a timed attempt update both layers: the temporary colour remains visible during that attempt, while the newly saved permanent colour is revealed after reset.

### 5. Preserve marks and assessment behavior
- Keep the existing server-authoritative, line-keyed mark record and its idempotent score calculation.
- Rechecking a permanently completed line during a timed attempt may confirm that temporary attempt line, but must not persist or award its mark again.
- Do not alter AI assessment, timer operation, line progression, reset semantics, question navigation, or Smartboard layout.

## Technical details
- Add a small shared progress-colour validator/resolver with blue/brown fallbacks so invalid or legacy values cannot break rendering.
- Thread the two values through the existing assessment-loading gateways and public guest payload rather than creating a second progress or Smartboard system.
- Keep the existing state precedence: temporary timed-attempt state wins visually only when the timer layer is active; permanent achievement remains the stored source beneath it.
- Update generated application types through the normal backend migration flow; no new table is required.

## Validation
- Add focused tests for:
  - timer off: permanent colour only
  - timer on: current-attempt colour overlays permanent colour
  - reset: temporary colour disappears and permanent colour remains
  - newly earned marks persist beneath a timed attempt
  - repeated success does not increase the saved score
  - custom colours and identical colour pairs both work
  - invalid/legacy settings fall back to blue and brown
- Verify the actual Student Smartboard indicator on desktop, tablet, and phone, including the existing three-at-a-time navigation window.
- Verify teacher changes persist after reload and appear on student and guest assessment boards without changing saved progress.
