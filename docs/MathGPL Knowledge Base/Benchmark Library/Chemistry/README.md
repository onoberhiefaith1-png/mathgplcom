# Chemistry reference lessons

The six approved reference lessons live in
`supabase/functions/notebook-ai/chemistryBenchmarks.ts`:

1. Atomic Structure
2. Chemical Bonding
3. Balancing Chemical Equations
4. Mole Concept and Stoichiometry
5. Acids, Bases and Neutralisation
6. Introduction to Organic Chemistry

Copilot learns their shape and quality from them, but never copies their text.
Every equation and molar mass in these lessons is checked automatically by
`chemistryValidator.ts`, using the tests in `src/lib/lessonnotes/__tests__/chemistry.test.ts`.
To change a lesson, edit that one entry. The teaching rules themselves are in
`chemistryStandard.ts`, which is versioned.
