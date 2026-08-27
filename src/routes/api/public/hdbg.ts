import { createFileRoute } from "@tanstack/react-router";
async function probe(url: string) {
  const t = Date.now();
  try {
    const c = new AbortController();
    const timer = setTimeout(() => c.abort(), 4000);
    try {
      const r = await fetch(url, { headers: { apikey: process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? "" }, signal: c.signal });
      return { url, status: r.status, ms: Date.now() - t };
    } finally { clearTimeout(timer); }
  } catch (e) { return { url, err: String(e), ms: Date.now() - t }; }
}
export const Route = createFileRoute("/api/public/hdbg")({
  server: { handlers: { GET: async () => {
    const base = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
    const out = await Promise.all([
      probe(`${base}/rest/v1/`), probe(`${base}/auth/v1/health`), probe(`${base}/storage/v1/version`),
    ]);
    return new Response(JSON.stringify(out), { headers: { "content-type": "application/json" } });
  } } },
});
