# Full interface translation — layout never moves

Two things are wrong today. First, changing language changes the layout: the whole page is flipped to right-to-left for Arabic, and longer translated words push panels out of shape. Second, only a small part of the platform is translated (about 150 labels), so most pages stay English.

The rule from here on:

- **Layout is fixed.** Language changes words only. No flipping, no re-flow, no shifting panels. The page looks pixel-identical in Chinese, Arabic, Russian or English.
- **Everything the platform owns is translated.** Buttons, menus, headings, field labels, placeholders, empty states, toasts, statuses, tab names, tool names.
- **Nothing a person typed is translated.** Lesson-note titles, topics, subtopics, class names, student and teacher names, school names, session values, notebook content, and all mathematics stay exactly as entered.

The test I will use on every page: imagine a brand-new account with no data in it. Every word visible on that empty page must translate. The moment a word came from a teacher's keyboard, it stays untouched.
