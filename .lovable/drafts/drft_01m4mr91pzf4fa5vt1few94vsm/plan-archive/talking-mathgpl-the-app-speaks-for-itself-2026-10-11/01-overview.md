# Talking MathGPL — the app speaks for itself

## The honest answer

Yes, this can be built. But it has to change one thing about the current Tutor.

Today Tutor recognises fixed sentences. If you word something differently, it says "I don't understand". If the right screen isn't open, it says "screen isn't opened yet". A list of fixed sentences can never feel like MathGPL talking. That is why it feels scripted.

A Talking MathGPL needs two things:

1. **A map of MathGPL itself.** We build it automatically from the app's own code: every page, every button action, every class, note, Session and Game you own, and how to reach each one. When the app changes, the map changes with it. Nobody has to write prompts.
2. **A small, cheap brain that reads the map.** It understands what you mean in your own words, in any language. Then it picks the right place and action from the map. It never writes mathematics. Copilot and the Math Engine still do that.

The key rule: **it goes there itself.** If you say "add a table to my set notation note", it opens your notes, finds that note, opens it and runs the table action. It does not tell you to open the screen first.

## What it costs

The brain only picks a destination and an action. It writes almost nothing. Each spoken turn costs a tiny fraction of a credit, far less than one lesson note. A full day of normal use stays under the cost of a single note. Mathematics content (Copilot, AI Edit) costs the same as it does today, and Tutor always tells you before using it.

Without internet, the current offline matcher is still there as a fallback, together with offline speech and queued actions. Offline it is simpler, because real understanding of free speech needs the brain.

## What it can do

- **Go anywhere by meaning:** "show me Faith's results in JSS2", "open last week's algebra game", "where do I upload a video for Session 3".
- **Set up Copilot:** opens Create Note, fills in topic, subtopic and class, passes your instructions, then waits for you to say "Proceed".
- **Edit for you:** "make that table have a Sum Row", "fix line 4". It opens AI Edit on the right item and applies the change after you confirm.
- **Run lessons:** drives the Smartboard, Floating Numbers and Guide step by step, and says each stored line out loud.
- **Explain MathGPL:** "how do Subcells work?" It answers from the app's own structure, not from guesses.
- **Help students:** finds their Academia activity, opens Practice or Play, and reads hints from stored solutions.

## What it will not do

- It will not invent mathematics. Every solution still comes from Copilot or the Math Engine.
- It will not delete, publish, assign or spend credits without asking you first.
- It cannot see the screen like a person. It acts only through MathGPL's own actions, which is also why it is reliable.
