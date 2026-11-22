# Lesson Notes assignment release checks

Use a sandbox school and ordinary accounts with the same roles, subject assignments, and entitlements as the people being compared. Check two independent school teachers, the administrator-linked teacher signed into the equivalent role, a school owner, an enrolled student, a student from another school, and a parent linked to only one test student. Use separate browser profiles and normal sign-in. Keep the test assignments in the sandbox.

## Reproduce the staff workflow

1. Use one short note and one long note with at least 40 questions. Include two legacy subsections under one section, a worked solution with a diagram, and a multiple-choice question that has the declared answer under an otherwise empty Solution heading.
2. Open Floating on a saved question and then on a recently created question. Compare the time to feedback and the time to usable highlighting. Confirm that the text, diagram, and existing highlights belong to that question. Repeat with browser network throttling, then retry after reconnecting.
3. Select the legacy multiple-choice question and choose Convert to MCQ. Confirm that its stem, options, and declared answer survive and that Assign appears. Paste or generate the same question structure and check automatic placement.
4. Assign both sibling questions separately to the same Academia Session. Open each Practice card in both a clean browser profile and the existing profile, then on a phone. Each card should show only its own question, lines, diagrams, and marks. Check the most recent assignment appears after returning to the Session.
5. Assign to multiple eligible classes with one failed save. Check the successes remain selected, the unsuccessful selection can be retried, and the attempt adds no extra copies to successful classes.
6. Verify that an enrolled student can open the intended Practice, an unrelated student cannot open it, and the parent sees only their linked test student's information. A teacher outside the assigned subject should not be able to add cards. Compare with the test account only under equivalent permissions.

## Compare releases and timings

Record each browser or installed app version, whether its profile already had saved work, network conditions, and the MathGPL build shown by Update. Compare the running build with the public build at `/api/public/app-version`. Record the initial build before using Update and run the same check afterward on each affected device.

In the browser console, filter for `[lesson-workflow]` and copy those entries only. Each entry contains the operation, workspace category, running build, duration, outcome, and a recognised cause when available. Compare `floating.open` with `floating.load`, and compare `assign.options`, `academia.catalog`, and `academia.submit` separately. This identifies whether the wait is before navigation, while reading data, or during the save. Keep raw console logs, network captures, lesson text, and sign-in information out of reports.

Report the build, role, scenario, pass or failure, and elapsed time separately for each run. Record which runs used a live independent account and which used test fixtures.
