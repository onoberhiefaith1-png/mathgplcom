# Imagine — complete it without making it heavy

Rule for every item: **compare with the original Game → list what's missing → add it only if it stays light → re-test speed.**

## 1. Exponent bracket bug (first, highest priority)
Imagine shows `5x( )²` and `√(b( )² …)` where the lesson note shows `5x²` and `√(b² − 4ac)`.
Imagine currently draws surface text with a different maths reader than the original Game. Step one is to confirm exactly where the empty `( )` comes from (the hidden-answer markers inside the stored text), then make Imagine draw text through the same maths formatting the original Game and lesson notes use. No extra brackets, boxes or symbols ever appear that aren't in the lesson note. Checked on squares, roots, fractions and powers inside roots.

## 2. Writing surface size and position
- Surface spans **5% to 95%** of the screen width (instead of a narrow centred column).
- Surface **starts small and grows** with its writing; never stays cramped while content grows.
- Text always stays inside the surface at any text size.

## 3. Writing styles (surfaces)
Bring over the original surface styles — paper, parchment, cloud and the other designed styles — as flat pictures with matching ink colour. These are just backgrounds, so they are light. Teachers pick them in the Imagine editor.

## 4. Text settings
In Settings: text size (bigger/smaller slider, already present, kept) plus **text colour**. Both light.

## 5. Rewards that come out of the surface
Each reward sits on its writing surface. When earned it plays in stages:
1. lights up on the surface,
2. lifts out of the surface,
3. grows to a prominent, near-full-screen moment,
4. performs its own achievement motion,
5. glides smoothly off screen.

Ball, calculator and the other objects each keep their own activation style from the original Game (bounce, spin, pop, etc.), rebuilt as flat motion. All of this stays in its separate layer: writing, marking and the next line never wait for it, and slow devices get a shorter version.
