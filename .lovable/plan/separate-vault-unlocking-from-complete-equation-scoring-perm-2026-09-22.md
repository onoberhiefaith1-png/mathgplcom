# Separate Vault unlocking from complete-equation scoring permanently

## Confirmed failure

The marked saved Game has these exact definitions for Line 1:

```text
Full line to score:  x + 7 = 12
Vault code:          x + 7
Teaching note:       Subtract 7 from both sides:
```

The Vault path is already independent: it watches the live ordered token sequence and opens when `x + 7` appears. It does not directly write marks or completed lines.

The actual score leak is in the authoritative equivalence grader. When the teacher target contains an equals sign but the student entry does not, the current rule accepts the entry if it equals either side of the teacher equation. Therefore `x + 7` is incorrectly accepted as equivalent to the complete line `x + 7 = 12`. That award then correctly reaches the Game as a completed line, increments Completion, fires completion rewards, and reveals the note. The note is reacting to a real—but wrongly issued—mark, not directly to the Vault.

## Fix

### 1. Enforce complete mathematical statement shape before equivalence

Add an authoritative grading prerequisite before symbolic, numeric, or AI equivalence:

- If the teacher line is an equation or relation, the student must also submit a complete equation or relation.
- Both sides must contain valid mathematical content; dangling or missing sides cannot be marked.
- A standalone expression matching only the teacher’s left side or right side cannot earn the line mark.
- The same rule applies before the AI fallback, so AI cannot override it.
- A complete, mathematically equivalent equation remains valid, including rearrangement and side swapping.
- If the teacher target is genuinely an expression rather than an equation, the existing expression-equivalence behavior remains unchanged.

For the reported line:

```text
x + 7          → Vault may open; line score = 0; note hidden
7 + x          → no Vault; line score = 0; note hidden
x + 7 = 12     → Vault opens; line score awarded; note appears
12 = 7 + x     → no exact Vault match; equivalent line score awarded; note appears
x + 7 =        → incomplete; line score = 0; note hidden
```

### 2. Keep the two event paths explicitly separate

Preserve two independent one-way paths:

```text
Exact ordered Vault sequence
  → consume that Vault only
  → add its Vault reward only
  → reveal its Vault effect only

Complete student line
  → authoritative complete-statement check
  → mathematical equivalence check
  → mark awarded
  → completed line recorded
  → completion rewards activate
  → teaching note appears
```

No Vault event, consumed-Vault key, Vault count, or Vault reward may be accepted as evidence of line completion.

### 3. Harden the Game award bridge

Keep `lastAwardedLineId` as the only Game completion input, but accept it only as the result of a fresh authoritative correct verdict for the exact question, line ID, and full current expression. Preserve the existing stale-request cancellation so an older partial check cannot publish after the student adds more symbols.

Reset the transient “last awarded” event when the question/run changes, without deleting teacher Vault configuration. Previously earned persisted marks remain governed by the existing assignment rules; a new Game run starts with no false local completion event.

### 4. Keep note and reward gates strict

- Note visibility remains based only on `completedLines` created from the valid award event.
- Completion coin and ordinary line rewards remain based only on that same completed-line state.
- Vault remains exact ordered matching and can open before the equation is complete.
- Incorrect, incomplete, or partial entries reveal no note and fire no completion reward.

## Regression coverage

Add authoritative grading tests for:

1. Teacher `x + 7 = 12`, student `x + 7` → not correct.
2. Teacher `x + 7 = 12`, student `12` → not correct.
3. Teacher `x + 7 = 12`, student `x + 7 =` → not correct.
4. Teacher `x + 7 = 12`, student `x + 7 = 12` → correct.
5. Teacher `x + 7 = 12`, student `12 = 7 + x` → correct.
6. Teacher expression `x + 7`, student `7 + x` → preserve valid expression equivalence.
7. AI fallback cannot turn an incomplete expression into a correct equation result.
8. Exact Vault `x + 7` opens independently and does not alter marks, completion count, completed lines, saved question result, note visibility, or completion rewards.
9. Equivalent full equation can earn the mark without opening a differently ordered Vault.

## Live verification

Use the current saved Game and reset its test run:

1. Enter only `x + 7` on Line 1.
2. Confirm its Vault opens and Vault total changes.
3. Confirm score remains `0 / 6`, Completion remains `0`, no completion coin/ordinary reward fires, and “Subtract 7 from both sides:” stays hidden.
4. Complete the entry as `x + 7 = 12`.
5. Confirm the authoritative mark is awarded once, Completion becomes `1`, line-completion rewards fire once, and only then the note appears.
6. Reset and enter `12 = 7 + x`; confirm the mark and note appear while the `x + 7` Vault does not open from reordered tokens alone.
7. Repeat an incomplete entry on another line and confirm no award or note leakage.

## Not changing

No change to Floating Numbers selection, Vault authoring or exact matching, teacher mathematics, marks, notes, reward values, Slate Artisan, Game layout, rooms, text rendering, timers, or Reset’s preservation of teacher design.
