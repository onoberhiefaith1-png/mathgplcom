## What is happening

The screenshot is not a random UI crash. The Generate Solution request is reaching the `notebook-ai` backend and returning a non-2xx response. The recent backend logs show repeated `POST /notebook-ai` responses with status `422`, which matches the app error dialog.

The most likely root cause is the strict `QUESTION_LOCK` check: for Solution blocks, the backend requires the AI's first solution line to match the inherited question. For questions written as prose plus math, like:

```text
Rationalize the denominator of \frac{\sqrt{3}}{\sqrt{10} - \sqrt{5}}.
```

the AI often restates only the math expression or rewrites the instruction slightly. The backend correctly rejects that as a mismatch, but the frontend currently rethrows many non-2xx errors, so users see the full app error overlay.

## Step-by-step fix plan

1. **Confirm the failing path precisely**
   - Use the live notebook data and backend function logs to isolate the `generate` request for the Solution section.
   - Confirm whether the 422 body is `question_lock_mismatch` or another validation/inheritance rejection.

2. **Make Solution matching robust for prose + math questions**
   - Keep the security/integrity rule: the AI must not solve a different problem.
   - Improve the backend matching so it accepts a valid restatement of the mathematical target when the parent question contains teacher instruction text plus a math expression.
   - For this example, both of these should be accepted as the same locked problem:

```text
Rationalize the denominator of \frac{\sqrt{3}}{\sqrt{10} - \sqrt{5}}.
\frac{\sqrt{3}}{\sqrt{10} - \sqrt{5}}
```

3. **Make the backend return a usable fallback instead of breaking the app**
   - If the AI still fails to restate the question after retry, return a controlled JSON error with clear details.
   - Avoid unhandled exceptions so the app does not show the Lovable error overlay to teachers or clients.

4. **Harden the frontend Generate Solution handler**
   - Update the Lesson Notes editor so all non-2xx Generate Solution failures are caught locally.
   - Show a normal toast/message such as “I couldn’t safely match this solution to the question. Please try again or simplify the question text.”
   - Do not rethrow the error into React, because that is what causes the app-level crash overlay.

5. **Test the exact failing notebook case**
   - Use the stored notebook question from the screenshot: rationalizing `sqrt(3)/(sqrt(10)-sqrt(5))`.
   - Verify Generate Solution either inserts the worked solution or fails gracefully without the app error dialog.
   - Re-check that the strict protection still rejects genuinely different questions.

6. **Deploy the backend function after the fix**
   - Deploy the updated `notebook-ai` function so the live preview and published app use the corrected behavior.

## Files I expect to change

- `supabase/functions/notebook-ai/index.ts`
  - Improve `QUESTION_LOCK` matching and controlled error behavior.
- `src/components/lessonnotes/DocumentEditor.tsx`
  - Catch Generate Solution backend failures and prevent the app overlay.
- Possibly `supabase/functions/notebook-ai/validator.ts`
  - Only if the final issue is the sanitizer/matcher normalizing math incorrectly.

## Success criteria

- Clicking AI Generate under a Solution section never causes the app-level “Error / Try to fix” overlay.
- The specific surd/conjugate question from the screenshot can generate a solution reliably.
- If the model tries to solve a different question, it is rejected safely with a teacher-friendly message.
- Existing `QUESTION_LOCK` and question inheritance protections remain intact.