# Community refitted around the Teaching Hub

The Teaching Hub stays exactly as it is. What changes is the layer above it: Community stops behaving like a second dashboard and becomes a publication and discovery layer that only ever *points at* Teaching Hub content.

Three roles, never mixed:

- **Teaching Hub** — owns everything, private by default. Untouched by this work.
- **Community Dashboard** — one per person, showing only what that person deliberately published. Optional: a teacher who has published nothing has no public Community Dashboard at all.
- **Main Community** — a living feed that aggregates every published item from every Community Dashboard.

Confirmed while checking the current code: shared lesson notes already open the *original* notebook rather than a copy, and every listing already stores `owner_id` plus a `source_id` back to the original asset — so the reference model is partly in place. Two real gaps: **courses have no publish path to Community at all** (nothing in the course tables or the publish dialog marks a course as shared), and the Main Community pages read as category boxes rather than a feed.
