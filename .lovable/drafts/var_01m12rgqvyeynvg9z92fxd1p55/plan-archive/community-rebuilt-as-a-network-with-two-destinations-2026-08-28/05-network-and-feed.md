## 5. Community — the network

The landing page reads as a professional education network: a title band ("Discover teachers, schools, students, parents, learning resources and live teaching across MathGPL"), a prominent global search, the four people categories, then **Live now**, then Learning, then the Feed.

- **Live now** pulls real rows: sessions currently flagged live and public, with the owner's profile attached, plus **Join Live**. Schools with an active public session appear in the schools rail. Empty state only when the query really returns nothing — never a hard-coded "No schools".
- **People discovery**: Teachers / Schools / Students / Parents directories with role-appropriate filters, results shown as rich profile cards (photo, name, headline, specialisms, location, qualification, years of experience, counts of courses / notes / live sessions, **View Profile** and **Connect**).
- **Learning**: Lesson Notes, Classes, Adventures, Courses, MyGPL Live, Smart Cards — discovery categories only, with sort by most viewed, most liked, recently added, plus filters for subject, year group and curriculum. Every card shows creator, type, title, topic, year, description, views, likes, comments, date and an Open action.
- **Search**: one search across people, all content kinds, posts and hashtags, with tabbed results and result counts.
- **Requests**: reuses the existing connection/request machinery, exposed with the right verb per pairing (teacher→school "Request to teach", school→teacher "Invite", student→teacher "Request to learn", parent→teacher "Request to connect", student→school "Request to join"). No second request system.

## 6. Feed, posts and hashtags

A real feed with posts authored from Community (posting is the one thing that originates here, since a post is not teaching material):

- Post body, media (image/video), category, hashtags, optional attached shared item.
- Views, likes, comments, shares, and clear author attribution (photo, name, professional headline, time).
- Promotional posts for maths apps, games, software, courses, books and services — same card shape, clearly labelled as promotion, mixed into the feed rather than bolted on as banners.
- Hashtags are free-form: typing `#Yea…` suggests existing tags ranked by how much Community content carries them, with counts. Clicking a hashtag opens its discovery page spanning posts and content. No fixed default list.
- Public post and comment text passes the existing AI moderation screen before it goes live.

## 7. Visual direction

Keep the deep blue environment, gold framing and glowing crystals of the building, and carry that language into dense dashboard surfaces: profile cards, content cards, tabs, filters, live pulses, activity indicators, strong type hierarchy. Existing design tokens only — no new hard-coded colours.
