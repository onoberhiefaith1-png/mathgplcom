## Build phases

**Phase 1 — architecture (no visible change yet)**
- `src/lib/i18n/languages.ts`: the language catalogue — code, English name, endonym, flag, `rtl` flag, `popular` flag. English is marked permanent. Popular list = Arabic, Bengali, Chinese, French, Hindi, Indonesian, Japanese, Portuguese, Russian, Spanish; everything else lands in All Languages, both sorted alphabetically by English name with no overlap.
- `src/lib/i18n/locales/en.ts` — the master catalogue, one flat key per platform string (`lesson_note`, `assignment`, `save`, `best_time`, `sign_out`, …), typed so every other locale must match its key set.
- `src/lib/i18n/LanguageProvider.tsx` + `useT()`: resolves active locale, falls back to English per key, exposes `myLanguages`, `active`, `setLanguage`. Mounted in `src/routes/__root.tsx` inside the existing auth provider. Sets `<html lang>` and `dir` for Arabic.
- Preference storage: a staged additive migration adds `ui_language` and `ui_languages` to `profiles`; signed-out visitors use `localStorage`, and on sign-in the local value merges into the account list without duplicates. Because this is a draft, the columns exist only after the draft is accepted — until then the provider transparently uses local storage.

**Phase 2 — the selector**
- `src/components/i18n/LanguageSelector.tsx`: globe trigger showing the active endonym, popover with the three sections, check mark on the active language, English pinned first and not removable. Selecting adds-once, activates, saves.
- Mounted in `AcademyTopBar` (Building/workspace shell) and in the Welcome page header, so it is reachable without opening Settings.

**Phase 3 — string extraction, surface by surface**
Replace hard-coded platform labels with `t()` calls, in this order: root shell and navigation (`workspaceNav.ts`), Welcome/Business Management, Account & auth screens, teacher hub and Lesson Notes chrome, Smartboard chrome, classes, assignments, adventures, assessments, progress/reports, student and parent consoles, school and admin consoles, then shared dialogs, toasts, empty states and error text. Only labels the platform owns; any string rendered from notebook/question/adventure data stays untouched.

**Phase 4 — one language at a time**
Chinese first: generate the complete `zh.ts`, switch the app into it, walk every surface from Phase 3, fix leftovers, then repeat for Arabic (including right-to-left layout), Bengali, French, Hindi, Indonesian, Japanese, Portuguese, Russian, Spanish. Terminology uses the natural educational term in each language, not a word-by-word rendering. A key-parity test fails the build if any locale is missing keys.

**Phase 5 — verification**
Automated: key parity, no duplicate language entries, English-permanence, alphabetical ordering, add-once behaviour, persistence round-trip. Browser: switch English → Chinese → French → Spanish → English, confirming the interface changes, the choice persists across reload, My Languages accumulates without duplicates, and a lesson note with a matrix, fractions, Floating Numbers and emoji mathematics renders identically in every language.

## Guardrails

- No geolocation, IP or timezone input to language selection, ever.
- Mathematical renderers, parsers, graders and asset pipelines are not modified.
- Missing translation → English text, never a visible key or placeholder.
- Adding a language later means adding one catalogue entry and one locale file; the selector and sections update automatically.
