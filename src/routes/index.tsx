import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import Index from "@/pages/Index";
import WelcomePage from "@/pages/WelcomePage";
import { useAuth } from "@/lib/auth/AuthProvider";

/**
 * The front door. Signed-out visitors see only the welcome screen; the
 * rotating building — and everything behind it — appears once signed in.
 */
const Landing = () => {
  const { user, ready } = useAuth();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_20%_20%,hsl(220_60%_22%),hsl(224_65%_10%)_60%)] text-white/70">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  return user ? <Index /> : <WelcomePage />;
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MathGPL — Mathematics teaching and learning platform" },
      {
        name: "description",
        content:
          "MathGPL brings lesson notes, SmartBoard teaching, live sessions and adventures together for schools, teachers, parents and students.",
      },
      { property: "og:title", content: "MathGPL — Mathematics teaching and learning platform" },
      {
        property: "og:description",
        content:
          "MathGPL brings lesson notes, SmartBoard teaching, live sessions and adventures together for schools, teachers, parents and students.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});
