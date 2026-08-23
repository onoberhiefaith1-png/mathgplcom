## 1. Fix the two lesson-note shelves

Both shelves become explicitly owner-scoped in the query, so the database returns only your own notes for that workspace:

- Personal workspace: owner = me, no organisation.
- School workspace: owner = me, organisation = the active school.
- Read-only "view as" (school reviewing a member, owner impersonation) keeps its existing explicit owner filter — a deliberate, relationship-based path, not a leak.

Community and shared-class notes keep appearing where they belong (Community page, class pages, school review) and nowhere else. Copy-to-my-workspace already creates a note owned by the copier; that is unchanged.

## 2. Fix Adventures the same way

The adventures list gains the same owner + workspace scope, so another teacher's published or class-linked adventure never appears in your own list.

## 3. Audit every other "my …" list in one pass

Every list that represents *my* content must carry an explicit owner or explicit membership filter in the query itself — never rely on the broader read paths, and never filter after fetching. Surfaces to walk and correct where the filter is missing: lesson notes (active and archive), Smartboard shelf, Adventures, Smart Cards, assessments and assignments, custom assets, slide decks, class galleries, reports, and the Community "my published" views. Already-correct ones (custom assets, for example, which filters by owner) are left alone.

The audit rule per surface: whose content is this list, and is that "whose" written into the query? If it can only be answered by the permissive read paths, it is wrong.

## 4. Read vs write, relationships, defaults

No permission-model change is needed — it already works this way and stays that way: notes are private on creation, write and delete are owner-only, students and parents reach content only through their class or child relationship, and school review is read-only. This plan does not widen any of it; it stops private-shelf bleed-through.

## 5. Encryption — what is true and what I will not claim

- Traffic is already HTTPS/TLS everywhere.
- Data at rest (database and file storage) is encrypted by the managed backend with AES-256; files sit in private buckets behind signed links.
- I will **not** label this end-to-end encrypted: the server must read lesson content to render, present, sync and generate from it. Claiming E2EE would be false.
- A second application-level AES-256-GCM layer over lesson content would break search, AI generation, presentation and copying — and would not have prevented this bug, which is purely authorization scope. If you want field-level encryption for one specific sensitive field (for example student personal details), name the field and I will scope that separately with server-held keys.
- No custom cryptography will be written.

## 6. Verification I will actually run

With two real accounts: signed in as B, confirm the shelf shows zero notes owned by A (including the two currently published), Adventures shows zero of A's, Community still shows A's published lesson, and copying it creates a B-owned note leaving A's original untouched. Then direct-access checks: request A's note, adventure and asset while authenticated as B and confirm the database refuses rather than the interface hiding it; request a stored file by path without a signed link and confirm refusal. Finally re-confirm A's own shelf, class sharing and school review still work.

## Technical notes

- `src/pages/LessonNotesPage.tsx` and `src/components/smartboard/SmartboardShelf.tsx`: add an `owner_id` equality filter taken from the session (never a client-supplied id) alongside the existing workspace filters; keep `withOwnerView` as the explicit read-only view-as override.
- `src/lib/games/games.ts` (`listGames`): same owner scope.
- `src/lib/accounts/workspaceScope.ts` gains a `scopeToMe(query)` helper used by every "my content" list, so the rule is one function rather than a convention.
- No migration: current policies are correct and deliberately support Community, class sharing and school review. Nothing is revoked.
- Any further shelf found without an owner filter during the audit is corrected with the same helper in the same change.
