import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/hdbg")({
  server: { handlers: { GET: async () => {
    const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? "";
    let out: unknown;
    const t = Date.now();
    try {
      const r = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key }, signal: AbortSignal.timeout(6000) });
      out = { status: r.status, ms: Date.now() - t };
    } catch (e) { out = { err: String(e), ms: Date.now() - t }; }
    return new Response(JSON.stringify({ url, keyLen: key.length, out }), { headers: { "content-type": "application/json" } });
  } } },
});
