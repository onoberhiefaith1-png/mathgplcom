# Replace outdated AI models

The AI catalog now lists these models used by MathGPL as deprecated (none are retired and no shutdown date is confirmed): gemini-2.5-flash (22 uses), gemini-2.5-flash-lite (4), gemini-2.5-flash-image (2), gemini-3.1-flash-image (2), gemini-3.6-flash (6), gemini-3.7-flash (1), gpt-5-nano (4), gpt-4o-mini-tts (1), gpt-4o-mini-transcribe (2).

## Proposed changes
- Text/maths generation (notebook generator, Floating Numbers, Smart Calc, geometry, Co-Pilot): move to a current Gemini Flash model from the live catalog. This keeps cost and speed close to what you pay today.
- Aura's fast line and everyday brain: move both to current low-cost Flash models. Your rule is that Aura costs pennies per day, so it stays off expensive models.
- gpt-5-nano calls: switch to the same current Flash model.
- Images (game covers, folder covers): switch to the current default image model.
- Voice: switch reading-aloud to the current speech model and transcription to the current transcription model.
- Model names, output limits, retries and streaming stay the same apart from the swap. Then each feature is tested once.

## Technical details
- First, re-check every replacement ID against the authenticated listing. Change only the model strings and any request fields the new models require.
- Update the Aura memory rule naming FAST_MODEL/AGENT_MODEL so it lists the new IDs.
