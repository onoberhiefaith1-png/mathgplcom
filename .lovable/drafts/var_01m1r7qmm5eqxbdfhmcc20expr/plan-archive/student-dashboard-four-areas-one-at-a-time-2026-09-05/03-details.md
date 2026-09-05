## Technical notes

All work stays in `src/pages/accounts/StudentDashboard.tsx`, plus one small prop on the shell.

- Local `const [area, setArea] = useState<"learning" | "connections" | "courses" | "overall">("learning")`. The hero renders always; below it exactly one area block renders. No routes are added, so a refresh returns to Learning by design.
- **Area bar**: a compact `grid grid-cols-4` control after the content, each item an icon (`GraduationCap`, `Users`/`Building2`, `BookOpen`, `Gauge`) plus label, active item using the existing `border-primary/40 bg-primary/15 text-primary` treatment. `min-h-[44px]` touch targets, `aria-current`.
- **Learning**: the existing `AREAS` card grid, unchanged.
- **Connections**: the existing `ownerList` for schools and teachers; the collapsible wrappers built in the previous pass become plain groups inside this area (they are already behind a deliberate click). The "Waiting to be opened" block moves out of here.
- **Courses**: reuse `useMySkillBuilders()` — the same rows the aggregate Skill Builder page uses — grouped by `className`, each linking to `/student/class/{classId}/courses/{courseId}` when `unlocked`, otherwise showing Locked, matching `StudentAllSkillBuilderPage`. No new query or table.
- **Overall View**: render the existing `rail` node (Overall Progress, Class Progress, Go Live `RailCard`s) inline in the main column, with the "Waiting to be opened" list above it. Same `useMyProgress` data, no recalculation, no duplicated component — the `rail` JSX is lifted into a `const overall` used by both the area and the drawer.
- `WorkspaceLayout` gains an optional `onRailIconClick?: () => void`; when provided the header info icon calls it instead of toggling the internal drawer, so the ⓘ selects the Overall View area. Default behaviour for every other page is unchanged.

Verification: `tsgo --noEmit`, then an authenticated Playwright pass at 1280x1800 and 428x712 confirming Learning is the default, each of the four items switches the content, and no schools, teachers, progress, Go Live or waiting list appears on the default screen.
