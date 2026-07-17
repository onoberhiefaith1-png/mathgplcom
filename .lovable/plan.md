## Replace Shift/Ctrl arming with `#` and `##` triggers

Update `src/components/lessonnotes/extensions/MathKeyShortcuts.ts`:

**Remove**
- The window-level `keydown`/`keyup` listeners that detected lone Shift/Ctrl taps.
- The `armSuper` / `armSub` plugin state and the keydown branch that consumed the next character after arming.
- The `SUPER` / `SUB` maps stay (they are the character tables) but are triggered differently.

**Add — hash trigger via `handleTextInput`**
Track a small plugin state:
```ts
{ pending: null | "sup" | "sub", triggerFrom: number | null, lastPair: ... }
```

Behaviour on each text input character `ch` at caret `from`:

1. If `pending === null`:
   - If `ch === "#"`: insert `#` as usual, set `pending = "sup"`, `triggerFrom = from` (position of the `#` just inserted). Return false (let PM insert).
   - Otherwise no-op.
2. If `pending === "sup"`:
   - If `ch === "#"` and the previous char at `from-1` is the `#` we just inserted: upgrade to `pending = "sub"` (keep the second `#` visible for now, remember both trigger positions).
   - Else look up `SUPER[ch]`. If mapped: prevent default insertion, delete the trigger `#` and insert the mapped superscript glyph in its place. Clear pending.
   - If not mapped: clear pending, let the char type normally (the `#` stays as literal text — same rule as `@` today).
3. If `pending === "sub"`:
   - Look up `SUB[ch]`. If mapped: delete both `##` triggers and insert the subscript glyph. Clear pending.
   - If not mapped: clear pending, leave `##` as literal text.

Any selection change, arrow-key move, or doc mutation not caused by this flow clears `pending` (handled in the plugin `state.apply` by resetting whenever the selection moves away from `triggerFrom + n`).

**Keep unchanged**
- Smart bracket pairing `() [] {} ||`, overtype-closer, backspace-deletes-pair.
- `/` smart-fraction behaviour.
- The `SUPER` / `SUB` character maps.

**Not touched**
- `AtCommand.ts` and the `@` quick-insert flow — this change is confined to `MathKeyShortcuts.ts`.

### Technical notes
- Using `handleTextInput` (not `handleKeyDown`) means OS-level Shift/Ctrl combos, IME, and browser shortcuts are never intercepted — the trigger is a printable `#`, so there is zero conflict with system keys.
- The `#` characters are inserted first and then removed on successful conversion, so PM history/undo produces the natural single-step undo (one undo restores `#2` as typed).
- If the user types `#` and then moves the caret or clicks elsewhere, `pending` clears and the `#` remains as a literal hash.
