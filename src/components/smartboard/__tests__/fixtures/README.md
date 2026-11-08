# Quadratic regression fixture

`academia-quadratic-catalogue-v8.json` is the public pack read from
https://mathgpl.com/api/public/academia-pack on 8 November 2026 (Europe/London).
Only the hierarchy containing activity `46fafd8f-9a08-4ac5-af3c-149fb22008bc`
is retained; unrelated schools, branches, activities and MCQ papers are omitted.
The activity/board payload, authored line identities, order, marks and chips are
unchanged. Its actual tier is Intermediate and it has no attached Game.

The mounted tests use the actual AcademiaApp → OfflineActivity →
PresentationView → FreeWriteLayer/FloatingNumberPanel path. A schema-7-shaped
copy (the same equation lines without the leading standalone note) reproduces
an update completing after a Session was opened. Persistence/network/browser
geometry and unrelated editors are mocked, not note production or board state.

The Play tests mount ImaginePlayPage with its actual useGameRuntime and board.
Only ImagineStage's visual receiver is replaced to inspect the production slot
payload. One test attaches a synthetic Game to the authentic quadratic board;
another uses an explicitly synthetic question with a later zero-mark note.
Neither is evidence that the public quadratic has a configured Game. No test
uses the network, changes a database, or tests an installed physical device.
