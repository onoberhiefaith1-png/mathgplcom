# Predictive Line: structured maths and no raw syntax

## What goes wrong today
- The Predictive Line checks equivalence by comparing plain algebra text. When a line has a fraction written in the stored form (`\frac{3x}{3}`), the checker cannot read it. It then reports "NO VALID ROUTE" even though the maths is fine.
- In the evaluation panel, the Predictive Line value goes straight to the screen as text. Expected and Student lines already go through the maths display. That is why you saw `\frac{3x}{3} = \frac{15(3)}{3}`.

## What you will get
- One shared **maths reader** turns any line into a tree of parts: numbers, letters, operators, fractions, powers, roots (including index roots), brackets, absolute value, subscripts, functions (sin, log…), mixed numbers, and relations (= ≠ < > ≤ ≥). It works whether the line came from the stored form, Floating Number chips, or typed input like `3x/3`, `√(x+2)`, `x²`.
- The Predictive Line uses that tree to check its work. `3x/3 = 15/3`, `√25 = 5`, `x² × x³ = x⁵`, `(2x+3)/(x+1) = 5` and `3x/2 > 6` are all recognised and compared as maths, not as text.
- Three clear states in place of one catch-all:
  - **Valid**: the line is proper maths. It is either equivalent or on a route to the answer.
  - **Incomplete**: a part has been started but not finished (a fraction with no bottom, an empty root, a trailing `=`). The label reads "Keep going — finish the fraction".
  - **No valid route**: shown only when the line is complete, proper maths and genuinely cannot reach the expected line.
- One shared **maths display** for Expected, Student, Predictive, the evaluation result and the note in the Game evaluation panel. It shows real fraction bars, superscripts, radical signs and brackets that grow with their contents.
- A final safety check before anything is shown. If a value still holds code (a backslash command, braces, a token list), it is turned into maths. If that fails, it is replaced with "Continue with a valid mathematical step." Code never shows up as text.
- Rewards and marks get only the result ("Equivalent" and so on), never raw strings. Expected Line behaviour stays exactly as it is now.
