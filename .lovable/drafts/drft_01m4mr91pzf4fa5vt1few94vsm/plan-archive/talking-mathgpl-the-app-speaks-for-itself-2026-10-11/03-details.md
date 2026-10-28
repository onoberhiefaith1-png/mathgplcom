## Build steps

1. **Check what exists.** Review the current Tutor, its action list and which screens actually register actions. List the gaps before changing anything.
2. **Generate the MathGPL map.** Build it from the route list and the action registry, so every page and every registered action appears automatically. Add a live list of the user's own classes, notes, Sessions and Games, filtered by their workspace.
3. **Self-navigation.** Each action states which screen it needs. If that screen isn't open, Tutor opens it, waits for it to register, then runs the action. This removes "screen isn't opened yet".
4. **The brain.** Add one server function that sends the spoken words and the map to a small, fast model with the actions as tools. It returns a plan of steps, not maths. It refuses to write solutions and passes those requests to Copilot.
5. **Confirmation and cost.** Delete, publish, assign and anything that spends credits always ask first. Every turn's cost is logged next to the existing usage meter.
6. **Offline.** No connection means the current matcher, offline speech and the action queue take over. When the connection returns, queued actions run only after you confirm them.
7. **Tests.** Cover map generation, workspace isolation, self-navigation ordering and the confirmation rules. Then do a signed-in browser check: "create a lesson note on set notation for JSS1".

## Technical notes

- Model: `google/gemini-2.5-flash-lite`, through the gateway as a chat-completions call with tools. It's a small, low-cost model, matching the project's "pennies per day" rule. No reasoning model.
- The map is compact JSON (route id, purpose, params, actions with their arguments), cached per build. The user's items are added per request, trimmed to names and ids.
- Workspace scoping goes through the authenticated server function, so the brain never sees data from another workspace.
- Aura stays archived and is not reused. The Tutor's no-maths rule is kept: the Guide still only speaks stored lines.

## One question for you

The brain makes Tutor understand you, but it uses a very small amount of credit when online. Is that acceptable, as long as a full day costs less than one lesson note?
