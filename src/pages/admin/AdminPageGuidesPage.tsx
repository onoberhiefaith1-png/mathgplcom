import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, PlayCircle } from "lucide-react";

import DashboardShell from "@/components/accounts/DashboardShell";
import { Button } from "@/components/ui/button";
import { listPageGuides, setGuideStatus, type PageGuide } from "@/lib/guides/pageGuides";
import { pageKeyLabel } from "@/lib/guides/pageKey";
import { toast } from "sonner";

/**
 * Overview of every guide video on the platform. Guides are created where they
 * are used — from the guide control on the page itself — so this page exists to
 * see the whole set at a glance and publish or unpublish without hunting.
 */
const AdminPageGuidesPage = () => {
  const [rows, setRows] = useState<PageGuide[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    void listPageGuides().then((found) => {
      setRows(found);
      setBusy(false);
    });
  }, []);

  const toggle = async (guide: PageGuide) => {
    const next = guide.status === "published" ? "draft" : "published";
    try {
      await setGuideStatus(guide.pageKey, next);
      setRows((prev) => prev.map((r) => (r.pageKey === guide.pageKey ? { ...r, status: next } : r)));
      toast.success(next === "published" ? "Guide published." : "Guide unpublished.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <DashboardShell title="Page Guide Videos" subtitle="One optional guide video per page, stored once and watched by everyone.">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-4 text-xs text-muted-foreground">
          To add or replace a guide, open the page itself and use the gear beside the Guide control.
        </p>

        {busy ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading guides…
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">No guide videos uploaded yet.</p>
        ) : (
          <ul className="divide-y divide-border/70">
            {rows.map((guide) => (
              <li key={guide.pageKey} className="flex flex-wrap items-center gap-3 py-3">
                <PlayCircle className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{guide.title || pageKeyLabel(guide.pageKey)}</p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">{guide.pageKey}</p>
                </div>
                <span
                  className={
                    guide.status === "published"
                      ? "rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
                      : "rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
                  }
                >
                  {guide.status === "published" ? "Published" : "Unpublished"}
                </span>
                <Button variant="outline" size="sm" onClick={() => void toggle(guide)}>
                  {guide.status === "published" ? "Unpublish" : "Publish"}
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link to={guide.pageKey.includes(":id") ? "/" : guide.pageKey}>Open page</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardShell>
  );
};

export default AdminPageGuidesPage;
