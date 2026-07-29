// smart-card-preview — crawler-facing HTML for a published Smart Card.
//
// The app is a static SPA, so social crawlers only ever read the one static
// index.html head. This public GET endpoint server-renders a per-card head so
// shared Smart Card links show the real title and question. Humans are
// redirected straight to the SPA challenge card.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SITE = "https://golden-hour-academy.lovable.app";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") ?? url.pathname.split("/").pop() ?? "").trim();
  const origin = url.searchParams.get("origin") ?? SITE;
  if (!/^[a-z0-9]{3,64}$/.test(slug)) {
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: card } = await admin
    .from("smart_cards")
    .select("slug, title, presentation, published")
    .eq("slug", slug)
    .maybeSingle();

  if (!card || !card.published) {
    return new Response("Smart Card not available", {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const target = `${origin.replace(/\/$/, "")}/c/${card.slug}`;
  const title = String((card.title as string) || "MathGPL Smart Card").slice(0, 90);
  const question = String(((card.presentation as any)?.questionText ?? "")).replace(/\s+/g, " ").trim();
  const description = (question ? `${question.slice(0, 140)}` : "Solve this maths challenge on the MathGPL Smartboard — instant AI marking.");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} — MathGPL Smart Card</title>
<meta name="description" content="${escapeHtml(description)}" />
<link rel="canonical" href="${escapeHtml(target)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="MathGPL Life" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${escapeHtml(target)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Quiz",
    name: title,
    url: target,
    educationalLevel: "Mathematics",
  })}</script>
<meta http-equiv="refresh" content="0; url=${escapeHtml(target)}" />
<script>window.location.replace(${JSON.stringify(target)});</script>
</head>
<body>
<p>Opening <a href="${escapeHtml(target)}">${escapeHtml(title)}</a>…</p>
</body>
</html>`;

  return new Response(html, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
});
