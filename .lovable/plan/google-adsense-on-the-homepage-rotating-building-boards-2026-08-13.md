# Google AdSense on the homepage + rotating-building boards

Add the provided AdSense script to the homepage only, and give the rotating building's boards a real advertisement pocket so an AdSense ad sits inside a board as if the board were built for it. Nothing else on the site serves ads.

## Where ads are allowed

```text
/  (signed out)  cinematic homepage  → one natural in-page ad placement
/  (signed in)   rotating building   → AdSense inside the billboard board
every other page                     → no AdSense at all
```

The script tag is loaded from the homepage route's own `head()`, not from the shared root layout, so it never reaches other pages.

## Rotating building

- The existing billboard board (the surface already used for uploaded image/video ads) gains a third creative kind: **AdSense**.
- An AdSense creative renders an ad unit clipped inside the board, at the board's existing 21:9 frame, with the same border, glow and "Ad" tag. The ad never overflows the board or covers the building artwork.
- Rotation, proportions, artwork, timing and the video pause/resume behaviour stay exactly as they are. An AdSense board behaves like an image ad: it holds for its configured duration, then rotation continues.
- Only the ad-enabled (Free / Community) building shows it. Pro and school buildings stay completely ad-free, exactly as today.

## Admin control

In the existing **Advertisements** console (platform owner only), each of the 8 slots can now be set to:

- Uploaded media (current behaviour), or
- **Google AdSense** — with a field for that slot's ad-unit slot ID.

Only slots you explicitly set to AdSense serve Google ads, so you keep full control of which boards are sold to Google and which stay in-house.

## Homepage (signed out)

One responsive ad block placed between two content sections in a natural break of the cinematic flow — full-width container, same dark surface and spacing as the sections around it, labelled "Advertisement", and hidden entirely if the ad fails to fill so no blank gap ever appears. It is not overlaid on the hero and does not interrupt a section's own media.

## Technical notes

- `src/routes/index.tsx` `head().scripts`: the `pagead2.googlesyndication.com` loader with `client=ca-pub-4814799388018236`, `async`, `crossorigin="anonymous"`. Homepage route only; `__root.tsx` untouched.
- New `src/components/ads/AdSenseUnit.tsx`: renders `<ins class="adsbygoogle">` with client + slot, pushes `adsbygoogle` once per mount (guarded against double-push in dev/StrictMode), reports fill state so the parent can hide an unfilled block. Client-only rendering to avoid SSR/hydration mismatch.
- `src/lib/homepage/advertisements.ts`: `AdCreative` gains `kind: "media" | "adsense"` with an optional `adSlotId`; `usePlayableAds` treats an AdSense slot as a timed (non-video) creative.
- `src/components/adventure/BuildingBillboard.tsx`: branches on `creative.kind` — `SignedMedia` as now, or `AdSenseUnit` inside the same clipped frame. No geometry or layout change to `RotatingAdventureScene.tsx` beyond passing the creative through.
- Additive migration on `platform_advertisements`: `ad_kind text not null default 'media'` and `adsense_slot_id text`, keeping existing GRANTs/RLS (owner-only writes, public SELECT of active rows).
- `src/pages/admin/Advertisements*`: per-slot kind selector and slot-ID input.
- `WelcomePage.tsx` gets the single homepage ad block; no CMS section is added or changed.

## Build order

1. Migration + `advertisements.ts` creative-kind support.
2. `AdSenseUnit` component and the homepage script tag on `/`.
3. Billboard AdSense branch on the ad-enabled building.
4. Admin slot controls (kind + slot ID).
5. Homepage in-page ad block with hide-on-unfilled.
