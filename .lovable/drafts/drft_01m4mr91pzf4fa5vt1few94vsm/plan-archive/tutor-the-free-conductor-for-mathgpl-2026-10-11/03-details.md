## Build order
1. Rename Aura Lite to MathGPL Tutor and add multi-step plans with slot-filling questions.
2. Create Note conversation, then hand off to Copilot with "proceed".
3. AI Edit hand-off on the open section, with a spoken summary of the changes.
4. Floating Number voice commands.
5. Smartboard guided playback with synced voice.
6. Academia split-screen guide, offline error coaching, and inclusion in the offline download.
7. Offline action queue, then sync when back online.

## Technical details
- **Action bus:** a small client registry (`src/lib/assistant/actions.ts`). Lesson Notes, Create Note, AI Edit, Floating Numbers and Smartboard register named handlers while they are mounted. Tutor only calls these handlers, so there is no screen reading and no clicking by position. Each handler returns success or failure, which lets multi-step plans check every step before going on.
- **Matcher:** extend `matcher.ts` with slot grammars for topic, subtopic, class, numbers, ordinals and symbols, plus a short follow-up state machine. All of this is pure and has unit tests.
- **Guided playback:** build a "script" from the stored solution lines (Floating Number tokens per line, plus teaching notes for the spoken text). The player activates tokens through the existing Floating Number insertion path, with the sensor disabled. Speech uses `speechSynthesis`, and each line waits for the end of its spoken line.
- **Coaching:** reuse the predictive and deterministic evaluator. When a line is wrong, compare it with the expected line and choose a spoken template (sign error, missing step, arithmetic).
- **Offline:** the script data is stored in the existing Academia offline pack (schema bump). The queue lives in IndexedDB (`academiaStore`, new `tutorQueue` store) and replays through `runAssistantAction` when the device is back online. You confirm each queued action before it is sent.
- **Unchanged:** Aura, Copilot and AI Edit generation logic, Floating Number layout rules and the assignment controls.
