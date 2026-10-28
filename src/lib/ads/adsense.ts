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

/**
 * Load the AdSense script *after* hydration.
 *
 * Loading it from the route `head()` let Google inject its own <ins> element
 * into the document before React hydrated, which React reported as a hydration
 * mismatch on every homepage visit. Injecting the tag from a client effect
 * keeps the server and client markup identical.
 */
export function loadAdSenseScript(): void {
  if (typeof document === "undefined") return;
  if (document.querySelector(`script[src="${ADSENSE_SCRIPT_SRC}"]`)) return;
  const script = document.createElement("script");
  script.src = ADSENSE_SCRIPT_SRC;
  script.async = true;
  script.crossOrigin = "anonymous";
  document.head.appendChild(script);
}
