## Step 1 — Stop the layout from moving

- Remove the right-to-left page flip. The document direction stays left-to-right in every language; Arabic and Hebrew text renders correctly inside its own labels without rearranging the interface.
- Make chrome length-proof: fixed widths for sidebar/top-bar items, single-line labels with ellipsis where a translation is longer, and no layout that depends on the English word length. Verified by comparing screenshots of the same page in English and in Chinese, Russian and Arabic.

## Step 2 — Cover the whole platform, page by page

The current 150-label catalogue grows into a complete one. Order of work:

1. **Public first page** (`/welcome`) — everything from the hero to the footer, plus Log in / Log out.
2. **Rotating building / home chrome** — Log out, Account, Personal Workspace, MathGPL Community, Teaching Hub, Assets, Backgrounds, "Search any maths topic", building tools.
3. **Teaching Hub** — both panels: title and subtitle, greeting, Building, the four counters, Upcoming schedule and its empty text, Quick actions, Recent activity, Plan, Credits, My Schools, My Students, overview labels.
4. **Lesson Notes dashboard** — title, Smartboard, Archive, Create notebook, notebook card labels (Class, Session, Subject, Topic, Subtopic), badges, empty states.
5. **New notebook dialog** — every label, every placeholder, both buttons.
6. **Lesson-note editor** — Symbols, Matrix, Slide, Emojis, page size, paper, zoom, Export, Present, Manual/AI mode, Sections, Explanation / Example / Solution, Floating, Assign, and the panel and toast text around them.
7. **Remaining consoles** — Classes, Adventures, Skill Builder, MathGPL Live, Subscription, Pricing, Community, Requests, Account and settings, student, parent, school and admin surfaces, plus shared dialogs, confirmations, errors and toasts.

My own dashboard stays as it is.

## Step 3 — One language at a time

English is the master. Then, one at a time and fully finished before the next: Arabic, Bengali, Chinese, French, Hindi, Indonesian, Japanese, Portuguese, Russian, Spanish. Each language uses the natural educational term, not word-by-word substitution. A check fails the build if any language is missing a label.

## Step 4 — "Update translations" on the admin dashboard

A button on my dashboard that:

- scans the platform's master English catalogue for labels that are new or changed since the last run,
- lists exactly what is missing, per language,
- translates only those, leaving reviewed translations untouched,
- shows a per-language completion count and the time of the last run.

Existing translations are never silently overwritten; nothing is machine-changed unless it is genuinely new or edited.

## Technical notes

- `src/lib/i18n/locales/*` grows from ~150 to the full platform key set, typed against English so a gap is a build error.
- `LanguageProvider` keeps writing `lang` but no longer writes `dir`; the RTL flip is dropped by design.
- Text that comes from the database (notebooks, classes, people, sessions, notes, mathematics) is never passed through `t()` — that boundary is the safeguard against translating teacher input.
- Update tool: a server function comparing a stored fingerprint per English key against the current catalogue, generating only the missing entries through the platform AI, writing them back into the locale files with a report.
