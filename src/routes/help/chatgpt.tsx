import { createFileRoute } from "@tanstack/react-router";

const TITLE = "Use MathGPL inside ChatGPT — MathGPL help";
const DESCRIPTION =
  "Connect ChatGPT to your MathGPL account and control lesson notes and the Smartboard live in a split screen.";

export const Route = createFileRoute("/help/chatgpt")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatGptHelp,
});

function ChatGptHelp() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-foreground">
      <h1 className="mb-2 text-3xl font-bold">Use MathGPL inside ChatGPT</h1>
      <p className="mb-8 text-muted-foreground">
        ChatGPT works as your own MathGPL account. It does not use MathGPL AI credits.
      </p>
      <h2 className="mb-2 text-xl font-semibold">Connect once</h2>
      <ol className="mb-8 list-decimal space-y-2 pl-6">
        <li>In ChatGPT open Settings → Apps &amp; Connectors → Advanced, and turn on Developer mode.</li>
        <li>Choose Create, name it MathGPL, and paste <code className="rounded bg-muted px-1">https://mathgpl.com/mcp</code>.</li>
        <li>Sign in with your MathGPL email and password, then press Allow.</li>
      </ol>
      <h2 className="mb-2 text-xl font-semibold">Split screen</h2>
      <ol className="mb-8 list-decimal space-y-2 pl-6">
        <li>Put ChatGPT on one half of the screen and mathgpl.com (signed in) on the other.</li>
        <li>Ask ChatGPT things like “open my Differentiation note”, “show it on the Smartboard”, “next step”, or “explain what's on my screen”.</li>
        <li>MathGPL changes straight away and shows a small “ChatGPT” notice at the top.</li>
      </ol>
      <h2 className="mb-2 text-xl font-semibold">Voice</h2>
      <p className="text-muted-foreground">
        Use ChatGPT's own voice button. If your ChatGPT version can't use connected apps while talking, type
        instead — everything else still works.
      </p>
    </main>
  );
}
