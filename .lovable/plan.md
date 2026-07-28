**Issue restated**
The current note still shows exponents wrongly: `x²` is displayed as a two-row script with an empty placeholder under it, and there are extra blank vertical gaps around the generated Example/Solution flow. This started showing after the Example/Solution insertion workflow changed, but the live test shows the visible math error is in the current inline math render path, not in the backend generation itself.

**Live test findings**
- The live DOM for the shown lesson note renders `x^{2}` as a `mathInline` node whose internal tree is `subsup`: base `x`, superscript `2`, empty subscript.
- `MathInlineCanvas` always renders both the superscript row and the subscript row for `subsup`, so an empty dashed slot appears underneath the exponent.
- The AI Edit preview looks correct because it uses the non-editable `renderMathInline` preview path, not the editable `MathInlineCanvas` path used inside the lesson note body.
- Web/code reference confirmed the CSS part: superscript alignment inside flex contexts is fragile unless the renderer explicitly separates read-mode script layout from editable-slot layout.

**Do I know what the issue is?**
Yes. The persistent exponent bug is caused by the lesson note’s editable inline math canvas rendering an empty subscript branch for simple exponents. A simple exponent should render as base + superscript only while not focused. The empty branch should only appear when the teacher is actively editing that math object and needs the slot.

**Files to fix**
- `src/components/lessonnotes/extensions/MathInlineCanvas.tsx`
- `src/components/lessonnotes/extensions/MathInline.tsx`
- `src/components/lessonnotes/DocumentEditor.tsx`
- `src/lib/lessonnotes/aiToNodes.ts` if blank paragraph cleanup needs to happen at AI-node conversion boundary
- Add/update focused regression tests for `x^{2}`, `x^{3}`, nested exponents, and Example → Solution insertion ordering

**Implementation plan**
1. **Restore clean exponent rendering in lesson notes**
   - In `MathInlineCanvas`, render `subsup` in two modes:
     - Read mode / unfocused: hide empty subscript or superscript rows completely.
     - Edit mode / focused: show subtle placeholders only for branches the teacher is actively editing or can enter.
   - For a simple stored value like `x^{2}`, the DOM should visually become `x` + raised `2`, with no empty box underneath.

2. **Keep infinite nesting/editing intact**
   - Do not remove `subsup` support or the recursive math tree engine.
   - Keep nested structures like `x^{2^{5^n}}` editable.
   - Only change the display rules for empty script branches, not the stored math structure.

3. **Make AI-generated lesson body use the same clean appearance as AI Edit**
   - Ensure generated inline math inside paragraphs is displayed through the clean read-mode math canvas when not selected/focused.
   - Keep AI Edit and lesson note rendering visually consistent for exponents, fractions, roots, and mixed prose/math lines.

4. **Tighten the Example/Solution spacing regression**
   - Compare the current `DocumentEditor` insertion path against the pre-auto-solution behavior around `solutionPlaceholderNodes`.
   - Remove extra blank paragraphs inserted between `Example`, generated question, and `Solution` while preserving the required structure:
     ```text
     Example
     generated question
     Solution
     blank solution area
     ```
   - Clicking/generating Solution must reuse the existing Solution heading, not create another one.

5. **Regression coverage and live verification**
   - Add focused tests for:
     - `x^{2}` renders without an empty lower placeholder.
     - `x_{2}` renders without an empty upper placeholder.
     - `x_{2}^{3}` still renders both rows correctly.
     - nested exponent storage stays lossless.
     - Example AI insertion lands before the existing Solution heading.
   - Run a live browser check on the same lesson note route and verify the screenshot/DOM no longer shows the empty slot under `x²`/`x³`, and spacing is compact.

**What I will not do**
- I will not rebuild the math engine.
- I will not roll back unrelated smartboard/editor work.
- I will not change the database schema.
- I will preserve the current Example → auto-empty-Solution requirement, but remove the visual/math regression it introduced.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>