# Mathemagine account and report changes

1. Open immediately in device-only student mode; sign-in is optional.
2. Replace Schools navigation with My account; keep school discovery accessible.
3. Separate Mathemagine email/password sessions with Student and Teacher account types.
4. Account-scoped learning history, cloud restore, conflict-safe merging and reset tombstones.
5. A small teacher workspace for public Session sharing, own reports, accepted student invitations and assignments.
6. Fresh links get fresh progress gateways, participant identities, name/photo entry and independent reports.
7. Reports include board questions, copied MCQ questions, Adventure questions and full Adventure completion.
8. Practice and Play share one question identity; retain the fastest correct result across methods and retries.
9. Durable submissions and live updates remain scoped to one teacher's share.
10. Five ranking rows visible at a time with scrolling to others; champions on the wheel; no disabled photo placeholders.
11. Remove the wall-clock display and extra Arena toolbar button.
12. Shared players cover Academia and public/downloaded Mathemagine.

Validation: 79 targeted tests pass across ten suites; 32 changed TypeScript files pass syntax transpilation. The database migration and privacy/share checks passed in a rolled-back transaction. No test accounts or groups were retained. The change is on codex/mathemagine-accounts-live-reports for review. Production migration, full application build, real signup/cross-device smoke tests and publication remain pending.


## Database release

Apply `drizzle/migrations/0020_mathemagine_accounts.sql` transactionally before deploying this feature. It adds optional account/profile, private progress, consented teacher/student connection and assignment tables, validates public-only teacher sharing, stores real participant photos, and provides an atomic fastest-result promotion RPC. It does not grant MathGPL lesson-authoring roles.

A rolled-back database rehearsal checked teacher/student isolation, accepted invitations and distinct gateways for repeated shares. A subsequent check confirmed zero retained test users or groups and that the production migration was not applied.

## Exact report examined

The Introduction Session behind the supplied display link currently assigns four board questions, three copied MCQ questions and four Adventure questions. The new report has twelve entries including the full Adventure timer. A source paper's unassigned questions are intentionally excluded.

## Verification limits

The local checkout is partial, so validation covers targeted runtime/UI/ranking/sync rules and SQL policies rather than a full app build. A production release still needs the migration, an application build, real student/teacher registration, cross-device restore and a live completion test for each activity type. No production student records were changed during this task.
