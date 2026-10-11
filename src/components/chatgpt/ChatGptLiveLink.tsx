// Live link between ChatGPT (via the MathGPL connector) and this open window.
// ChatGPT tools insert rows into chatgpt_commands for the signed-in user; this
// listener performs them. It also publishes what is on screen to chatgpt_presence.
import { useEffect, useState } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isFreshCommand, pathForOpen, smartboardSteps } from "@/lib/chatgpt/liveCommand";

type Cmd = { id: string; command: string; payload: Record<string, unknown>; created_at: string };

export default function ChatGptLiveLink() {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [userId, setUserId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUserId(s?.user.id ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const run = (c: Cmd) => {
      // Stale commands are cleared without being performed.
      if (!isFreshCommand(c.created_at)) {
        void supabase.from("chatgpt_commands").delete().eq("id", c.id);
        return;
      }
      if (c.command === "open") {
        const to = pathForOpen(c.payload.target, c.payload.notebookId);
        void router.navigate({ to: to as never });
        setFlash("ChatGPT opened a screen");
      } else if (c.command === "smartboard") {
        const key = c.payload.action === "previous" ? "ArrowLeft" : "ArrowRight";
        const n = smartboardSteps(c.payload.times);
        for (let i = 0; i < n; i++)
          setTimeout(() => window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })), i * 250);
        setFlash(`ChatGPT: ${c.payload.action}`);
      } else if (c.command === "refresh") {
        void router.invalidate();
        setFlash("ChatGPT updated this page");
      }
      void supabase.from("chatgpt_commands").delete().eq("id", c.id);
      setTimeout(() => setFlash(null), 2500);
    };
    const ch = supabase
      .channel(`chatgpt-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chatgpt_commands", filter: `user_id=eq.${userId}` },
        (p) => run(p.new as Cmd),
      )
      .subscribe();
    return () => void supabase.removeChannel(ch);
  }, [userId, router]);

  // Publish what is on screen (debounced) so ChatGPT can explain it.
  useEffect(() => {
    if (!userId) return;
    const t = setTimeout(() => {
      const m = pathname.match(/\/(?:lesson-notes|smartboard)\/([0-9a-f-]{36})/);
      const text = (document.querySelector("main") ?? document.body).innerText.slice(0, 6000);
      void supabase.from("chatgpt_presence").upsert({
        user_id: userId,
        route: pathname,
        notebook_id: m?.[1] ?? null,
        screen_text: text,
        updated_at: new Date().toISOString(),
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [userId, pathname, flash]);

  if (!flash) return null;
  return (
    <div className="pointer-events-none fixed left-1/2 top-3 z-[100] -translate-x-1/2 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground shadow-lg">
      {flash}
    </div>
  );
}
