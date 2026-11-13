import type { ReactNode } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { Link } from "@/lib/router-compat";
import { createFileRoute } from "@tanstack/react-router";
import { useAccount } from "@/lib/accounts/useAccount";
import { useResolvedBuilding } from "@/lib/homepage/useResolvedBuilding";
import HomepageBuildingPage from "@/pages/homepage/HomepageBuildingPage";

/** Platform owner, co-admin, or an account linked to one. */
function FreeBuildingGate({ children }: { children: ReactNode }) {
  const { roles, isLoading } = useAccount();
  const resolved = useResolvedBuilding({ adminPreview: "free" });
  const allowed =
    roles.includes("platform_owner") || roles.includes("co_admin") || resolved.isAdmin;

  if (isLoading || resolved.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (allowed) return <>{children}</>;

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <ShieldAlert className="h-8 w-8 text-amber-400" />
      <h1 className="text-xl font-semibold">Not available for this account</h1>
      <p className="text-sm text-muted-foreground">
        The Free building is chosen by the platform owner.
      </p>
      <Link to="/" className="text-sm text-muted-foreground underline">
        Back to the Building
      </Link>
    </div>
  );
}

const title = "Edit the Free Mathemagine building artwork";
const description =
  "Replace the artwork inside the platform-owned Free building that carries the advertisement billboard.";

export const Route = createFileRoute("/homepage/building/free")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <FreeBuildingGate>
      <HomepageBuildingPage />
    </FreeBuildingGate>
  ),
});
