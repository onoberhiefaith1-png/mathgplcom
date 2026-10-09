## What is actually wrong

I read the three relationships saved in this lesson note. The display code isn't the only problem. Saving damages the relationships themselves:

1. **The side links get damaged when saved.** The link to side CA is stored as `s_{C}A` when it should be `s_CA`. The underscore was turned into a subscript. This causes two problems:
   - the cleaner that hides links can't read them, so raw text leaks onto the page;
   - the side is no longer connected, so tapping a step doesn't light up AB, BC or CA on the diagram.
2. **The heading copies the equation.** Each step's title (the "principle") is filled with the same equation as the relationship. Students see the equation twice and never see a name like "Pythagoras' theorem".
3. **Some squares are missing.** Two of the saved lines read `CA = BC² + AB²` and `AB = CA² − BC²`. They should be `CA² = BC² + AB²` and `AB² = CA² − BC²`. Nothing warns the teacher about this.

## What students will see after the fix

Each step shows:
- a short title, such as **Pythagoras' theorem**;
- one clean classroom equation, such as **CA² = AB² + BC²**, with each side in its diagram colour;
- tapping the step lights up those sides on the triangle.

There will be no backslashes, braces or `georef`, and no duplicated line.
