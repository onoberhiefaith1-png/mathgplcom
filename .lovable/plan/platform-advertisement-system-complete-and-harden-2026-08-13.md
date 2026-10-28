# Platform Advertisement System — complete and harden

Most of this system already exists and works: the `platform_advertisements` table with 8 slots, admin-only access rules, the billboard layer on the rotating building, the Free/Pro/Community building rules, and the admin page at `/admin/advertisements` (already linked from the Platform Console). Nothing there gets rebuilt.

This plan closes the real gaps against your specification.

## 1. Provider architecture (manual now, Google later)

Add provider fields to the advertisement record so the building never knows where a creative came from:

- `provider` (`manual` | `google` | `other`, default `manual`)
- `provider_ad_id`, `campaign_name`
- `thumbnail_path`
- `starts_at`, `ends_at` (scheduling-ready; empty means always)
- `click_url` (optional destination for future reporting)

Introduce an adapter layer: a single resolver that turns a slot row into a normalized "creative" (`{ type, url, durationMs, provider }`). The billboard component consumes only creatives. A future Google adapter plugs into the resolver without touching the building.

Scheduling and provider fields are stored and shown, but only `manual` creatives render for now — a `google` row displays as "awaiting provider integration" in the dashboard rather than a broken frame.

## 2. Image dwell time actually honoured

Today a video holds the building still, but an image slot's configured "seconds on screen" is not used. The rotation controller will hold the building for the configured duration when an image ad faces the camera, then resume — matching your image flow (face → display → continue).

## 3. Dashboard upgrade (`/admin/advertisements`)

Rebuild the slot cards into a professional dashboard, per slot:

- Slot number and its permanent building position
- Thumbnail/preview, media type badge, active/inactive toggle
- Duration control (images) / "plays to the end" (videos)
- Provider, campaign name, optional schedule window
- Buttons: Preview (modal with full image/video), Replace, Remove

Plus a **Live building preview** panel at the top: the existing rotating building component rendered in Free/advertising mode, so you can verify billboard placement and video pause/resume before activating. It reuses the existing building — no visual redesign.

## 4. Security

Keep the existing admin-only database rules and extend them to the new columns; validate the provider value in the database so a normal user cannot write an arbitrary provider even if they call the API directly. The dashboard route stays behind the existing platform-admin guard.

## 5. Explicitly unchanged

Free/Pro plan logic, building customization pages, Community behaviour, student workspaces, plan gateway, credits/accounting, and the 16 building artwork slots are untouched. Ads remain only on the rotating advertising building (own homepage for Free accounts, and Community for everyone).

## Technical notes

- Migration: additive `ALTER TABLE public.platform_advertisements` for the columns above, a `CHECK` on `provider`, no data loss; existing rows default to `manual`.
- `src/lib/homepage/advertisements.ts`: add the creative resolver/adapter (`resolveCreative`), extend the upsert/patch mutations, and make `useFacingAdRotation` hold for image `duration_ms` as well as for video completion.
- `src/components/adventure/BuildingBillboard.tsx`: render from a creative rather than a raw row.
- `src/pages/homepage/HomepageAdvertisementsPage.tsx`: dashboard rework + preview dialog + live building preview.
- Media continues through the existing storage upload path (`uploadGameAsset`) — no second storage system.
