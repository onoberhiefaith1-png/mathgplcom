# Multilingual Platform (English master + 10 popular + all others)

Today the platform has no translation layer at all: every visible label is written directly into components, and nothing stores a language preference. So this is a new architecture, added as a layer on top of the existing app — no mathematics, Smartboard, Floating Numbers, emoji, adventure, timer, assessment or lesson-note behaviour is rewritten.

## What you get

- **English is permanent and first.** New users always start in English, never by country, IP or device location.
- **A globe selector** (`🌐 English ▾`) in the top bar of the Welcome page and the Building/workspace shell — visible without entering Settings.
- **Three sections in the menu:** *Default / My Languages* (English plus every language that user has ever picked, with a check on the active one), *Popular Languages* (Arabic, Bengali, Chinese, French, Hindi, Indonesian, Japanese, Portuguese, Russian, Spanish — alphabetical, English excluded), then *All Languages* (everything else the catalogue supports, alphabetical, no duplicates).
- **Picking any language** immediately switches the interface, adds it once to My Languages, and saves it to the account.
- **Persistence:** the active language and the personal list are stored on the user's account, so they survive logout, browser close and another device. Signed-out visitors keep their choice in local storage until they sign in, then it merges into the account.
- **Only platform text translates.** "Lesson Note", "Assignment", "Save", "Best Time", error and empty states all translate. Teacher-authored notes, questions, solutions, narration, uploads, and student work are never touched.

## How the work is sequenced

English first as the master catalogue, then one language at a time — generate the full set, switch the app into it, walk the screens, fix what is still English, then move on. Chinese, then the rest of the ten in alphabetical order.
