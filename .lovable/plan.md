# MathGPL Cost & Expense Catalogue + Billing section in the Platform console

Two deliverables, no pricing decisions:

1. A downloadable Excel workbook auditing every cost surface that already exists in MathGPL.
2. A **Billing & Costs** entry in the Platform console (next to Security, Email Dashboard, Add Account, Change Background) where the catalogue lives and can be downloaded.

## 1. The audit

The workbook is built from the real project, not from assumptions. The audit reads:

- Every AI-powered function in the project (notebook lesson-note generation, floating assistant and floating reasoning, smart calc, smart graph, smart card and smart-card game, geometry sketch and geometry edit, assessment grading, line grading, relationship AI, speech transcription, sound-effect generation, game-cover generation, lesson-note cover designer, course background generation, MCP) — each with the model it calls and what a single run consumes.
- Lesson notes: generation, blocks/sections/subsections storage, covers, class copies (assign-to-class duplication and check-out copies back to the workspace).
- Workspaces, classes and connections: school, teacher, parent, student accounts, shared school/teacher workspaces, and each of the six relationship pairs — what acceptance actually creates in the system, and where acceptance creates no new billable resource.
- Storage: the knowledge-document bucket, uploaded and generated images/video/audio, adventure and Skill Builder assets, smartboard state, student work and assignments, galleries, building assets, profile images.
- Live and real-time: Go Live, live sessions, smartboard synchronisation, adventure live sessions and heartbeats, presence, school/parent read-only viewing.
- Per-role consumption: school, teacher (personal vs school-funded vs parent-funded), parent, student.
- Email sending and the email queue, reports, and database growth per table family.

Anything found only as a reference or stub goes to the **Planned / Future Costs** sheet. Where a real provider price is not known, the cell reads "Provider cost required" — no invented numbers.

## 2. The workbook

File: `MathGPL_Master_Cost_and_Expense_Catalogue.xlsx`, delivered as a download in chat and stored so the Billing page can serve it.

Sheets:

1. **Master Cost Catalogue** — Category, Feature, Operation, Resource Consumed, Cost Type, Billing Unit, Provider/System Cost, Recurring?, Cost Driver, Who Consumes It, Potential Payer, Existing/Planned.
2. **AI Cost Catalogue** — one row per AI operation: Feature → Operation → Model/provider → Resource consumed → Billing unit → Trigger frequency.
3. **Workspace & Class Costs**
4. **Storage Costs**
5. **Live & Infrastructure Costs**
6. **Connection & Workspace Map** — per relationship: who requests, who accepts, what is created, workspace created?, class capacity consumed?, storage?, AI capacity?, cost of the relationship itself, responsible payer.
7. **Resource Map** — Resource → What creates it → What consumes it → Does it grow → Possible billing method.
8. **Cost Driver Summary** — user-based, workspace-based, usage-based, AI-based, storage-based, infrastructure-based.
9. **Planned / Future Costs**

Formatting: Arial, frozen header rows, coloured header bands in the console's navy/gold, column widths set for reading, wrapped text, no formulas needed.

Every sheet is rendered to images and inspected before delivery so nothing is clipped or misaligned.

## 3. Billing section in the Platform console

- A new **Billing & Costs** action button in the `/admin` header row beside Security, Email Dashboard, Add Account, Platform Owner and Change Background.
- A new page at `/admin/billing`, platform-owner only, in the same premium dark dashboard style:
  - **Cost Catalogue** card: what the document is, when it was generated, and a Download button serving the `.xlsx`.
  - **Cost driver summary** read-only cards: the six driver groups with the count of catalogued items in each.
  - **Resource map** read-only table: the resources the audit found, what creates them and whether they grow.
  - A short note that plan and price design is deliberately not started yet.
- No plan limits, prices, credit allocations or payment provider work in this step.

## Technical section

- Audit by reading source only: `supabase/functions/*`, `src/lib/**`, `src/pages/**`, `src/routes/**`, and the database function/table inventory. No schema changes, no migration.
- Workbook generated with a Python script using `openpyxl`, written to `/mnt/documents/MathGPL_Master_Cost_and_Expense_Catalogue.xlsx` and delivered as an artifact; a copy is placed under `public/` so `/admin/billing` can offer it for download.
- New files: `src/pages/admin/BillingCosts.tsx`, `src/routes/admin/billing/index.tsx` (head metadata, noindex), and a small `src/lib/admin/costCatalogue.ts` holding the summary/resource rows shown on the page so the UI matches the workbook.
- Edited: `src/pages/accounts/AdminConsole.tsx` to add the Billing & Costs action button.
- Access control follows the existing `/admin` route guard; no new policies.
