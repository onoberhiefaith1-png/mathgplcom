/**
 * Google AdSense configuration.
 *
 * AdSense is loaded on the homepage route only (`src/routes/index.tsx`) — never
 * from the root layout — so no other page of the site serves Google ads.
 */
export const ADSENSE_CLIENT = "ca-pub-4814799388018236";

export const ADSENSE_SCRIPT_SRC =
  `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;

/**
 * The in-page homepage ad unit. Paste the ad-unit slot ID from AdSense here to
 * render a dedicated block in the signed-out homepage flow. Left empty, the
 * homepage still loads the AdSense script (Auto ads) but renders no fixed
 * block, so the page never shows an empty advertising gap.
 */
export const HOMEPAGE_AD_SLOT_ID = "";
