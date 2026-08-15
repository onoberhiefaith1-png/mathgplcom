# MathGPL homepage: same design language, clear product story

The problem is communication, not visual quality. The hero, gold CTAs, dark cinematic sections, reveal animations, counters and footer all stay exactly as they are. What changes is the section order, the copy, and three new section layouts that let real application screenshots carry the story — with clearly designed placeholder frames until you upload them.

No AI-generated images, no invented features, no fake dashboards. Every image area is a CMS-editable slot (File or GPL Assets, same as today).

## New page order

```text
01  HERO                  Mathematics, Reimagined.        (unchanged, existing media)
02  INTRODUCTION          One platform. The complete mathematics learning journey.
03  AT A GLANCE           existing live counters (Schools / Teachers / Students)
04  FOUR PILLARS          Create · Teach · Practise · Master        (4 screenshot slots)
05  SMARTBOARD            Bring mathematics to life                 (screenshot)
06  FLOATING NUMBERS      Mathematics in Motion.                    (full-bleed spotlight)
07  WORKFLOW              Everything connects. 01-09 numbered steps (9 screenshot slots)
08  TEACHER WORKSPACE     Everything a teacher needs                (screenshot)
09  STUDENT WORKSPACE     Learning doesn't stop when the lesson ends
10  PARENT CONNECTION     Parents stay connected to learning
11  REPORTS               Know where every learner stands
12  PAYMENTS              Teach. Earn. Grow.   CTA: Set Up Payments
13  THE COMPLETE JOURNEY  School → … → Growth connected flow
14  FINAL CTA             Where mathematics becomes an experience.
15  FOOTER                unchanged (legal links, seller statement)
```

Existing sections that no longer serve the story (curiosity statement, the generic "world" cinematic band, the before/after compare, the generic audience cards) are hidden rather than deleted, so nothing you uploaded is lost and you can re-enable any of them from the website editor. Testimonials keep their hide-until-approved rule. The homepage ad block keeps its single natural break.

## Three new section layouts

- **Spotlight** — large rounded application screenshot beside a label + headline + one short line + optional chip row (e.g. `Lesson Notes → Smartboard → Assignments → Adventure → Reports`). Alternates left/right so consecutive sections never look identical. Used for Smartboard, Teacher, Student, Parent, Reports, Payments.
- **Workflow** — numbered steps (01-09), each with its own screenshot slot, title, one supporting line, and a connecting line/arrow down the spine. Horizontal on desktop scroll rhythm, stacked on mobile.
- **Journey** — the closing connected diagram: node chips joined by arrows, School → Teacher → Lesson Notes → Smartboard → Floating Numbers → Student → Assignment → Collaboration → Adventure → Assessment → Reports → Parent → Growth. Pure layout and motion, no imagery.

Floating Numbers gets the existing full-bleed cinematic treatment (largest type on the page, gold eyebrow `FLOATING NUMBERS`) with one wide screenshot frame directly beneath it, so it reads as a defining technology rather than a feature card.

## Editing it yourself

Every new section appears in `/admin/website` exactly like today's: show/hide, reorder, eyebrow, headline, supporting line, CTA, and one media slot per section or per item. The three new layouts also join the **Add section** library, so you can add another Spotlight, Workflow or Journey block whenever you want.

Screenshot slots are pre-labelled with what belongs there (School Dashboard, Teacher Dashboard, Student Dashboard, Parent Dashboard, Lesson Notes, Smartboard, Floating Numbers, 2D, 3D, Assignments, Collaboration, Adventure, Skills, Reports, Payments) so uploading is unambiguous.

## Technical notes

- `src/lib/site/types.ts`: add `spotlight`, `workflow`, `journey` to `SiteSectionKind`, matching `SECTION_TEMPLATES` entries and titles. Spotlight items carry the chip row; workflow/journey use `items` for steps/nodes.
- `src/components/site/SiteSections.tsx`: add `Spotlight`, `Workflow`, `Journey` renderers reusing `Reveal`, `SiteMedia`, `Primary`/`Secondary` and the existing `MediaFrame` placeholder gradients. No new palette, no new fonts, no new animation system.
- One additive migration inserts the new `site_sections` rows with copy and positions, flips the retired keys to `visible = false`, and renumbers positions. Existing rows keep their `media`.
- `src/pages/admin/WebsiteContentPage.tsx`: field map extended for the new kinds, including per-item media with the labels above.
- `src/routes/index.tsx` head(): title/description updated to the clearer positioning; `og:image` continues to come from the hero asset.
- Counters keep reading the live stats function; nothing about `stats`/`statsSettings` changes.
