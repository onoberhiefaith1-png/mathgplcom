# Smart Card Publishing for MathGPL Life

A Smart Card is not a new question type. It is a publishing mode for a question that already has a Solution. The teacher writes the question once in a Lesson Note; MathGPL Life exposes it as a public, interactive challenge that opens the existing Student Smartboard.

## Phase 1 — Question standardisation, Smart Card Editor, publishing, public challenge

### 1. Standardise the four question sections
Example, Classwork, Homework and Assignment run through one engine. Each supports Question Number, Solution, Working Area, Floating Numbers, Smartboard, Reasoning, AI Evaluation and Marks. The only difference is the label shown on the heading. Today the section-heading chips (AI / Floating / Assign) only attach to a Solution heading; that stays the trigger, but the surrounding section kind no longer changes behaviour anywhere in the pipeline.

### 2. Smart Card button (Life only)
A third chip, Smart Card, appears immediately after Assign on every question that has a Solution — but only when the Lesson Note was opened from a MathGPL Life route. Notes opened from the Teaching Hub never show it. No schema flag; the editor receives a "workspace" value from the route.

### 3. Smart Card Editor
Clicking Smart Card opens a dedicated editor page containing only that question — no solution, no other questions, no lesson note chrome. Editing here never touches the Lesson Note.

Presentation tools (reusing the Lesson Note editing engine):
font size up/down for a selection, resize individual or multi-selected emojis, resize maths symbols, resize and reposition diagrams, bold, italic, underline, text colour, alignment, copy, paste, duplicate, undo, redo, zoom.

If the question contains a geometry diagram it is pulled in automatically and stays editable with the existing geometry tools.

A live Card Preview beside the editor shows exactly what the audience will see.

### 4. Publish Smart Card
One button: Publish Smart Card. The system creates the card, its hidden short URL and the public challenge. The teacher never manages the URL — after publishing they see "Smart Card Published" with Copy Smart Card and Share Smart Card.

### 5. The published card
Title, question, diagram, emojis, and a Start Challenge button. No timer, score, leaderboard, ads, menus or tutorial on the card itself. Clicking anywhere on the card, or opening the raw URL, lands on the same Smartboard Challenge.

### 6. Smartboard Challenge
Reuses the existing Student Smartboard exactly as-is: Floating Numbers, Check, AI marking, Reasoning, instant scoring. No class, assignment or teacher presence involved. A subtle footer reads "Explore more with MathGPL Life".

Identity on open: Welcome → Continue as Guest (type a username, valid for this session only) or Sign in (Smartboard profile; username remembered for future cards, and this does not sign them into the wider MathGPL platform). Guests get the full experience — solving, AI marking and leaderboard qualification — through a public backend endpoint rather than an account.

### 7. Leaderboard
Only 100% qualifies. Ranked by fastest completion time. Earlier qualifying records are preserved; a faster later run is added as a new record rather than overwriting.

## Phase 2 (after Phase 1 is working)
- Rich link previews on social platforms.
- Smartboard profile sign-in and remembered usernames across cards.
- Leaderboard presentation polish and per-card stats for the teacher.

## Technical notes

- **Data**: new `smart_cards` table (owner, source notebook/subsection, title, presentation JSON, geometry snapshot, short slug, published state) and `smart_card_attempts` (card, display name, guest/user identity, percent, duration, completed_at). Additive migrations only, with GRANTs and RLS: public read of published cards, owner-only writes, attempts inserted only through the backend.
- **Public access without accounts**: the challenge cannot use normal RLS-authenticated reads for anonymous visitors. A public edge function serves the card payload by slug and records attempts, so no anonymous sign-up is introduced.
- **Question capture**: publishing snapshots the question content (text tree, emojis, geometry) into the card row so later Lesson Note edits never mutate a published card.
- **Board reuse**: the challenge route mounts the existing `PresentationView` with a Smart Card board scope instead of a class/assessment scope; the answer key comes from the snapshot's floating/solution data.
- **Rich previews (honest limit)**: this app is a static SPA, so social crawlers only read the one static `index.html` head — per-card previews need server-rendered meta. Phase 2 will serve crawler-facing card HTML from an edge function; the link itself works everywhere from day one.
