# ChatGPT lesson authoring draft

Branch: `codex/chatgpt-lesson-authoring`. This source is a draft; do not deploy,
refresh the shared plugin release, or merge it without the owner's acceptance.

ChatGPT authors lesson notes directly. It reads the canonical Copilot teaching
standards and AI Edit reconstruction standards through `get_lesson_standards`.
No lesson-generation model, Copilot or AI Edit is called by knowledge retrieval,
preview or structured saving. The teacher's ChatGPT usage still applies.

The flow is: understand the request and counts → optional references → write a
full draft → `preview_structured_lesson` → correct problems → teacher accepts →
`save_structured_lesson` with the exact preview digest → read back.

The teaching flow uses context rather than forcing the teacher through a fixed
questionnaire. Questions already answered are not repeated, zero counts omit
content, and no additional material is required after the teacher says no.

## What is enforced

- Exact section/question counts, including zero. Question kinds count each
  question, not their outer section container.
- Each question has its own solution with exact question restatement,
  meaningful working and renderer-compatible notation.
- Supplied arithmetic/equation checks are tied to the actual question and the
  displayed final answer. Unrelated checks and incorrect answers are rejected.
  Straightforward arithmetic and single-variable equations are also checked
  automatically when an explicit claim is omitted. Partial subexpressions cannot
  be substituted for the original target.
- A read-only preview produces an approval digest covering metadata, counts,
  every section/line and checks. Saving revalidates and requires acceptance of
  that same payload before authenticating or writing.
- Unsupported or numerically approximate checking requires explicit teacher
  mathematical review. It never becomes automatic verified success.
- Notebook ownership is still resolved from the authenticated caller. Structure
  read-back is reported separately from numerical answer checking.
- Legacy notebook tools cannot create/append content. Low-level insertion tools
  are not advertised to external authors, while internal executors remain intact.

Answer checks establish supplied final numerical results only. They do not prove
all intermediate transformations, domain restrictions, full root sets, proofs,
word-problem modelling or diagram geometry. Unsupported content is clearly
marked for teacher review. Native diagram/matrix/Smart Table saving is not added
by this change; reconstructed-object knowledge must not be mistaken for that
capability.

## Review in the isolated test environment

Use a test teacher/account and database when exercising saving. Do not create
test content on the owner's live account without explicit authorization.
The new unit tests use fixtures only and never call paid AI.

Local verification: 75 tests passed across the authoring, operating-guide and
MCP endpoint suites. A scoped strict TypeScript check of the changed components
and their immediate dependencies passed. That check uses a declaration for the
unchanged executor boundary; it is not a whole-application production build.
The endpoint suite uses signed test tokens and in-memory records, not live
accounts. Deployed-host behavior and Smartboard rendering remain to be checked
in an isolated environment.

1. Discover the tools through the MCP endpoint. Confirm the new preview and
   subject/focus parameters are advertised and old insertion bypasses are absent.
2. Load the operating guide and Mathematics standards. Ask for one explanation,
   two examples, no exercises and three classwork questions; decline extra
   material. ChatGPT should author the full draft without calling a generator.
3. Preview the draft. Check that counts and supported answers pass. Change a
   result, count or cover field after preview: saving with the old digest must
   fail. Reject the draft: no database write should occur.
4. Accept the unchanged draft and save. Read back and open it on the Smartboard;
   check every question owns its solution and the content renders correctly.
5. Repeat with an unsupported proof or inequality. It must request teacher
   mathematical review rather than claim the mathematics was machine verified.
6. Attempt to append content through the old create/update notebook tools;
   they must reject before changing data. Confirm another teacher's note cannot
   be written through the structured saver.

## Release after owner approval

Deploy this branch through MathGPL's existing hosting process. Preserve the
existing MCP URL, OAuth issuer, plugin identity, account scope and hosting.
Update the owned plugin's teaching skill from
`docs/chatgpt-plugin/skills/mathgpl-teaching/SKILL.md` through its supported
release process; do not edit an installed cache or create a duplicate plugin.
Refresh connector discovery and confirm `get_operating_guide`,
`get_lesson_standards`, `preview_structured_lesson` and `save_structured_lesson`
appear in a fresh authenticated host conversation. Source changes alone do not
update the already-installed ChatGPT connector.

Guide version: `2026-10-13.1`; MCP version: `0.3.0`. Existing external clients
must preview and supply approval fields before structured saving. Empty notebook
creation and cover-detail updates remain available. Existing low-level repair
and explicitly requested paid generation operations are not redesigned here.
# 14 October follow-up: canonical knowledge and activity fidelity

The direct authoring briefing now includes the exact exported AI Edit
`SOLUTION_SHAPE_DIRECTIVE`, in addition to the already shared Copilot,
pedagogy, benchmark, integrity, completeness and reconstruction standards.
`get_lesson_standards` returns repository source paths in `sources`.
The external-author briefing explicitly distinguishes Copilot's source-role
Math Engine delegation from ChatGPT's independent authorship. Teacher-side
solutions, targeted correction, and the highlighting → preparation → student
test → game workflow are explicit. No account-specific learned laws or model
weights are copied. No new paid AI generation is used.

Live comparison exposed a migration defect: the importer emitted Solution
labels as paragraphs, while the canonical outline parser requires structural
headings. New imports now use one question heading, one owned Solution
heading, and preserve every separately stored mathematical step. Tests run
these documents through the real outline/parser, including moved Solutions.
Already converted malformed documents are not silently rewritten.

Structured saving now compares actual problem/solution read-back with the
accepted payload. An empty solution or working folded into the problem cannot
produce `structureVerified: true`, even if the old generic inspector reports
no problems. Saving checks still do not certify every mathematical claim or
the full student game. Staging verification and the existing approved release
process remain required; these source changes do not activate the live plugin.
