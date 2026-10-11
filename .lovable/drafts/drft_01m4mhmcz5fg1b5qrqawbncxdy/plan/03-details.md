## Testing
- **Automatic tests:**
  - polyatomic ions, ionic charges, isotopes, mole calculations, limiting reactant and exo/endothermic reactions
  - an unbalanced equation is caught and an invented element is rejected
  - Floating Number grouping (H₂O and SO₄²⁻ stay whole)
  - Maths and Physics prompts are exactly the same as before
- **Live check:** once you accept the draft, generate one Chemistry lesson and do one targeted edit. This uses a small amount of AI credit, and I will tell you before running it.

## Limits
- Copilot is not permanently retrained. It follows the standard, the examples and the checks.
- Organic reaction mechanisms are explained in words and structural formulae. Drawn curly-arrow diagrams are not included in this step.
- Lab equipment pictures stay "Pending", as before.

## Technical details
- New `supabase/functions/notebook-ai/chemistryStandard.ts` (versioned) and `chemistryBenchmarks.ts` (six lessons, kept separate from the rules), plus `isChemistrySubject`. They are added to `subjectKnowledgeBlocks` next to Physics.
- New pure validator `src/lib/lessonnotes/chem/` (formula parser, atom/charge balance), with a copy for the backend. It reads element symbols from the Chemistry subject library.
- The Floating atoms tokenizer keeps chemical formulas and charges together only for the Chemistry subject.
- Six lessons are also saved as markdown under `docs/MathGPL Knowledge Base/Benchmark Library/Chemistry/`.
- Add a rule to `src/lib/lessonnotes/AGENTS.md`. Going live needs the backend function to be deployed when the draft is accepted.
