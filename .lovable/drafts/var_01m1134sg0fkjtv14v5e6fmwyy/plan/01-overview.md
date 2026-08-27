# Fix emoji display on the Floating Number page

The stored question is fine. I checked the saved solution for this subsection and it contains the real emojis:

```text
🍎 + 2🚗 = 14
3🍎 + 🚗 = 17
```

So nothing is wrong with the data, the Auto Generate output, the Smartboard, the solving engine or the scoring. The damage happens only while the Floating Number page draws the equation header line.

## What is actually broken

The Floating Number page turns each equation into selectable "atoms" (numbers, letters, operators, brackets, whole structures). That reader walks the text one UTF-16 code unit at a time. An emoji is two code units, so it is cut in half: each half becomes its own atom and each half renders as a replacement character. That is exactly why one apple shows as two diamonds:

`🍎 🍎 + 2 🚗 🚗 = 14`  →  `� � + 2 � � = 14`

The chips underneath already look correct because they come from a different path that keeps whole tokens.

## The fix

1. The atom reader steps by user-perceived character (grapheme) instead of code unit, so an emoji — including skin tones, joined sequences and flags — is always exactly **one** atom, never split.
2. That single emoji atom is an identity token, treated like a variable: selectable, movable, highlightable and convertible to a Floating Number chip like any other atom.
3. The atom is drawn with the system colour-emoji font at the same size as its neighbours, so it appears as the real emoji rather than a box, a placeholder or a label.
4. The same grapheme-safe stepping applies to the reader's single-character branches (bare √ argument, one-character superscript/subscript body) so an emoji cannot be halved there either.
